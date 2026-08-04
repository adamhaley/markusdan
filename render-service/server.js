import crypto from 'node:crypto';
import { once } from 'node:events';
import { mkdir, rm, stat } from 'node:fs/promises';
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

async function downloadFile(url, destination) {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(`Video download failed: ${response.status}`);
  }

  const output = createWriteStream(destination);

  for await (const chunk of response.body) {
    if (!output.write(Buffer.from(chunk))) {
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

function buildFilterGraph(count, durations) {
  const filters = [];
  const transition = Math.max(0.05, TRANSITION_DURATION);

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
  let currentDuration = durations[0];

  for (let index = 1; index < count; index += 1) {
    const duration = Math.min(transition, currentDuration / 2, durations[index] / 2);
    const nextVideo = `vx${index}`;
    const nextAudio = `ax${index}`;
    const offset = Math.max(0, currentDuration - duration);

    filters.push(`[${videoLabel}][v${index}]xfade=transition=fade:duration=${duration}:offset=${offset}[${nextVideo}]`);
    filters.push(`[${audioLabel}][a${index}]acrossfade=d=${duration}:c1=tri:c2=tri[${nextAudio}]`);

    videoLabel = nextVideo;
    audioLabel = nextAudio;
    currentDuration += durations[index] - duration;
  }

  filters.push(`[${videoLabel}]format=yuv420p[vout]`);
  filters.push(`[${audioLabel}]aresample=48000[aout]`);

  return filters.join(';');
}

async function render(sequence, renderId) {
  const workDir = path.join(TEMP_DIR, renderId);
  const outputPath = path.join(OUTPUT_DIR, `${renderId}.mp4`);

  await mkdir(workDir, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  try {
    const inputPaths = [];

    for (const [index, item] of sequence.entries()) {
      const sourceUrl = await getVimeoFile(item.videoId);
      const destination = path.join(workDir, `${String(index + 1).padStart(2, '0')}-${item.videoId}.mp4`);
      await downloadFile(sourceUrl, destination);
      inputPaths.push(destination);
    }

    const durations = await Promise.all(inputPaths.map(getDuration));
    const filterGraph = buildFilterGraph(inputPaths.length, durations);
    const args = inputPaths.flatMap((filePath) => ['-i', filePath]);

    args.push(
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

    await run('ffmpeg', args);

    return {
      renderId,
      videoUrl: `${PUBLIC_BASE_URL}/renders/${renderId}.mp4`,
      duration: durations.reduce((total, value) => total + value, 0) - TRANSITION_DURATION * (sequence.length - 1),
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

app.get('/healthz', (_request, response) => {
  response.json({ ok: true });
});

app.use('/renders', express.static(OUTPUT_DIR, { maxAge: '1d', immutable: true }));

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
      return response.json({
        ok: true,
        renderId,
        videoUrl: `${PUBLIC_BASE_URL}/renders/${renderId}.mp4`,
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
