import crypto from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';

const app = express();
app.use(express.json({ limit: '64kb' }));

const PORT = Number(process.env.PORT || 3400);
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const VIMEO_ACCESS_TOKEN = String(process.env.VIMEO_ACCESS_TOKEN || '');
const RENDER_API_KEY = String(process.env.RENDER_API_KEY || '');
const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || path.resolve('renders');
const TEMP_DIR = process.env.RENDER_TEMP_DIR || path.resolve('tmp');
const TRANSITION_DURATION = Number(process.env.TRANSITION_DURATION || 0.35);
const VIDEO_WIDTH = Number(process.env.VIDEO_WIDTH || 1280);
const VIDEO_HEIGHT = Number(process.env.VIDEO_HEIGHT || 720);
const VIDEO_FPS = Number(process.env.VIDEO_FPS || 30);
const MAX_SEQUENCE_ITEMS = 20;
const jobs = new Map();
const activeJobsByRenderId = new Map();

function assertConfig() {
  if (!VIMEO_ACCESS_TOKEN) {
    throw new Error('VIMEO_ACCESS_TOKEN is not configured');
  }

  if (!PUBLIC_BASE_URL) {
    throw new Error('PUBLIC_BASE_URL is not configured');
  }
}

function validateSequence(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_SEQUENCE_ITEMS) {
    throw new Error(`sequence must contain between 2 and ${MAX_SEQUENCE_ITEMS} items`);
  }

  return value.map((item, index) => {
    const videoId = String(item?.videoId || '').trim().split('/')[0];

    if (!/^\d+$/.test(videoId)) {
      throw new Error(`Invalid Vimeo videoId at sequence index ${index}`);
    }

    return {
      type: String(item.type || 'clip'),
      order: Number(item.order || index + 1),
      label: String(item.label || videoId),
      videoId,
    };
  });
}

function getRenderId(sequence) {
  const input = JSON.stringify({
    sequence: sequence.map(({ type, order, label, videoId }) => ({ type, order, label, videoId })),
    transitionDuration: TRANSITION_DURATION,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    fps: VIDEO_FPS,
  });

  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 24);
}

async function run(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  const [code] = await once(child, 'close');

  if (code !== 0) {
    throw new Error(`${command} failed (${code}): ${stderr.slice(-4000)}`);
  }

  return { stdout, stderr };
}

async function runWithProgress(command, args, onProgress) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  let stdoutBuffer = '';
  let progress = {};

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      const separator = line.indexOf('=');
      if (separator < 1) {
        continue;
      }

      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      progress[key] = value;

      if (key === 'progress') {
        onProgress(progress);
        progress = {};
      }
    }
  });

  child.stderr.on('data', (chunk) => { stderr += chunk; });

  const [code] = await once(child, 'close');

  if (code !== 0) {
    throw new Error(`${command} failed (${code}): ${stderr.slice(-4000)}`);
  }
}

async function getVimeoFile(videoId) {
  const response = await fetch(`https://api.vimeo.com/videos/${videoId}?fields=name,files` , {
    headers: {
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
      Authorization: `Bearer ${VIMEO_ACCESS_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Vimeo metadata request failed for ${videoId}: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const files = Array.isArray(data.files) ? data.files : [];
  const candidates = files
    .filter((file) => file.link && String(file.type || '').startsWith('video/'))
    .sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
  const file = candidates[0];

  if (!file?.link) {
    throw new Error(`No downloadable Vimeo file was returned for ${videoId}`);
  }

  return file.link;
}

async function downloadFile(url, destination, onProgress) {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(`Video download failed: ${response.status}`);
  }

  const output = createWriteStream(destination);
  const totalBytes = Number(response.headers.get('content-length') || 0);
  let downloadedBytes = 0;

  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    downloadedBytes += buffer.length;
    onProgress?.(downloadedBytes, totalBytes);
    if (!output.write(buffer)) {
      await once(output, 'drain');
    }
  }

  output.end();

  await once(output, 'close');
}

async function getDuration(filePath) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number.parseFloat(stdout.trim());

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not determine duration for ${filePath}`);
  }

  return duration;
}

function computeSegmentTimeline(durations, transitionDuration) {
  const transition = Math.max(0.05, transitionDuration);
  const startTimes = [0];
  const crossfadeDurations = [0];
  let currentDuration = durations[0];

  for (let index = 1; index < durations.length; index += 1) {
    const duration = Math.min(transition, currentDuration / 2, durations[index] / 2);
    const offset = Math.max(0, currentDuration - duration);
    startTimes.push(offset);
    crossfadeDurations.push(duration);
    currentDuration += durations[index] - duration;
  }

  return { startTimes, crossfadeDurations, totalDuration: currentDuration };
}

function buildFilterGraph(count, timeline) {
  const filters = [];

  for (let index = 0; index < count; index += 1) {
    filters.push(
      `[${index}:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,` +
      `pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2,` +
      `fps=${VIDEO_FPS},format=yuv420p,setpts=PTS-STARTPTS[v${index}]`,
    );
    filters.push(
      `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
      `asetpts=PTS-STARTPTS[a${index}]`,
    );
  }

  let videoLabel = 'v0';
  let audioLabel = 'a0';

  for (let index = 1; index < count; index += 1) {
    const offset = timeline.startTimes[index];
    const duration = timeline.crossfadeDurations[index];
    const nextVideo = `vx${index}`;
    const nextAudio = `ax${index}`;

    filters.push(`[${videoLabel}][v${index}]xfade=transition=fade:duration=${duration}:offset=${offset}[${nextVideo}]`);
    filters.push(`[${audioLabel}][a${index}]acrossfade=d=${duration}:c1=tri:c2=tri[${nextAudio}]`);

    videoLabel = nextVideo;
    audioLabel = nextAudio;
  }

  filters.push(`[${videoLabel}]format=yuv420p[vout]`);
  filters.push(`[${audioLabel}]aresample=48000[aout]`);

  return filters.join(';');
}

function getMetadataPath(renderId) {
  return path.join(OUTPUT_DIR, `${renderId}.json`);
}

async function readRenderMetadata(renderId) {
  try {
    const raw = await readFile(getMetadataPath(renderId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { duration: null, segments: [] };
  }
}

function updateJob(job, updates) {
  if (!job) {
    return;
  }
  Object.assign(job, updates, { updatedAt: new Date().toISOString() });
}

async function render(sequence, renderId, job) {
  const workDir = path.join(TEMP_DIR, renderId);
  const outputPath = path.join(OUTPUT_DIR, `${renderId}.mp4`);

  await mkdir(workDir, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  try {
    const inputPaths = [];

    for (const [index, item] of sequence.entries()) {
      const sourceUrl = await getVimeoFile(item.videoId);
      const destination = path.join(workDir, `${String(index + 1).padStart(2, '0')}-${item.videoId}.mp4`);
      const downloadStart = (index / sequence.length) * 60;
      const downloadSpan = 60 / sequence.length;
      updateJob(job, {
        stage: `Downloading video ${index + 1} of ${sequence.length}`,
        percentage: Math.round(downloadStart),
      });
      await downloadFile(sourceUrl, destination, (downloadedBytes, totalBytes) => {
        const fraction = totalBytes > 0 ? Math.min(downloadedBytes / totalBytes, 1) : 0;
        updateJob(job, {
          stage: `Downloading video ${index + 1} of ${sequence.length}`,
          percentage: Math.round(downloadStart + fraction * downloadSpan),
        });
      });
      inputPaths.push(destination);
    }

    updateJob(job, { stage: 'Preparing videos', percentage: 62 });
    const durations = await Promise.all(inputPaths.map(getDuration));
    const timeline = computeSegmentTimeline(durations, TRANSITION_DURATION);
    const filterGraph = buildFilterGraph(inputPaths.length, timeline);
    const args = inputPaths.flatMap((filePath) => ['-i', filePath]);
    const outputDuration = timeline.totalDuration;
    const segments = sequence.map((item, index) => ({
      type: item.type,
      label: item.label,
      startTime: Math.round(timeline.startTimes[index] * 100) / 100,
    }));

    args.push(
      '-progress', 'pipe:1',
      '-stats_period', '0.5',
      '-filter_complex', filterGraph,
      '-map', '[vout]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-y', outputPath,
    );

    updateJob(job, { stage: 'Rendering video', percentage: 64 });
    await runWithProgress('ffmpeg', args, (progress) => {
      const outputTime = Number(progress.out_time_us || progress.out_time_ms || 0) / 1_000_000;
      const fraction = outputDuration > 0 ? Math.min(outputTime / outputDuration, 1) : 0;
      updateJob(job, {
        stage: 'Rendering video',
        percentage: Math.min(99, Math.round(64 + fraction * 35)),
      });
    });

    updateJob(job, { stage: 'Finalizing video', percentage: 99 });
    await writeFile(getMetadataPath(renderId), JSON.stringify({ duration: outputDuration, segments }));

    return {
      renderId,
      videoUrl: `${PUBLIC_BASE_URL}/renders/${renderId}.mp4`,
      duration: outputDuration,
      segments,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

app.get('/healthz', (_request, response) => {
  response.json({ ok: true });
});

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Render-Api-Key');
  if (request.method === 'OPTIONS') {
    return response.sendStatus(204);
  }
  next();
});

app.use('/renders', express.static(OUTPUT_DIR, { maxAge: '1d', immutable: true }));

function authorizeRequest(request, response) {
  if (RENDER_API_KEY && request.get('x-render-api-key') !== RENDER_API_KEY) {
    response.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

function getJobResponse(job) {
  return {
    ok: job.status !== 'error',
    jobId: job.jobId,
    renderId: job.renderId,
    status: job.status,
    percentage: job.percentage,
    stage: job.stage,
    cached: job.cached,
    videoUrl: job.videoUrl || null,
    duration: job.duration ?? null,
    segments: job.segments || [],
    error: job.error || null,
  };
}

function startRenderJob(job, sequence) {
  render(sequence, job.renderId, job)
    .then((result) => {
      updateJob(job, {
        ...result,
        status: 'complete',
        percentage: 100,
        stage: 'Complete',
        cached: false,
      });
      activeJobsByRenderId.delete(job.renderId);
    })
    .catch((error) => {
      console.error(error);
      updateJob(job, { status: 'error', stage: 'Render failed', error: error.message });
      activeJobsByRenderId.delete(job.renderId);
    });
}

app.post('/render/jobs', async (request, response) => {
  try {
    if (!authorizeRequest(request, response)) return;

    assertConfig();
    const sequence = validateSequence(request.body?.sequence);
    const renderId = getRenderId(sequence);
    const outputPath = path.join(OUTPUT_DIR, `${renderId}.mp4`);

    try {
      await stat(outputPath);
      const metadata = await readRenderMetadata(renderId);
      const jobId = crypto.randomUUID();
      const job = {
        jobId,
        renderId,
        status: 'complete',
        percentage: 100,
        stage: 'Complete',
        cached: true,
        videoUrl: `${PUBLIC_BASE_URL}/renders/${renderId}.mp4`,
        duration: metadata.duration,
        segments: metadata.segments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);
      return response.status(202).json(getJobResponse(job));
    } catch {
      const existingJob = activeJobsByRenderId.get(renderId);
      if (existingJob) {
        return response.status(202).json(getJobResponse(existingJob));
      }

      const jobId = crypto.randomUUID();
      const job = {
        jobId,
        renderId,
        status: 'queued',
        percentage: 0,
        stage: 'Queued',
        cached: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);
      activeJobsByRenderId.set(renderId, job);
      startRenderJob(job, sequence);

      return response.status(202).json(getJobResponse(job));
    }
  } catch (error) {
    console.error(error);
    return response.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/render/jobs/:jobId', (request, response) => {
  const job = jobs.get(request.params.jobId);
  if (!job) {
    return response.status(404).json({ ok: false, error: 'Render job not found' });
  }
  return response.json(getJobResponse(job));
});

app.post('/render', async (request, response) => {
  try {
    if (RENDER_API_KEY && request.get('x-render-api-key') !== RENDER_API_KEY) {
      return response.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    assertConfig();
    const sequence = validateSequence(request.body?.sequence);
    const renderId = getRenderId(sequence);
    const outputPath = path.join(OUTPUT_DIR, `${renderId}.mp4`);

    try {
      await stat(outputPath);
      const metadata = await readRenderMetadata(renderId);
      return response.json({
        ok: true,
        renderId,
        videoUrl: `${PUBLIC_BASE_URL}/renders/${renderId}.mp4`,
        duration: metadata.duration,
        segments: metadata.segments,
        cached: true,
      });
    } catch {
      const result = await render(sequence, renderId);
      return response.json({ ok: true, ...result, cached: false });
    }
  } catch (error) {
    console.error(error);
    return response.status(500).json({ ok: false, error: error.message });
  }
});

await mkdir(OUTPUT_DIR, { recursive: true });
await mkdir(TEMP_DIR, { recursive: true });

app.listen(PORT, () => {
  console.log(`RSC render service listening on port ${PORT}`);
});
