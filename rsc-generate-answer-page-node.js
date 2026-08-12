// HTML Generator Code node
// Supported delivery modes: "vimeo" and "rendered".
const DELIVERY_MODE = 'rendered';
const RENDER_NODE_NAME = 'Render Video';
const RENDER_STATUS_BASE_URL = 'https://renders.megyk.com';

const resolved = $('Call').first().json;
const oembed = $('Get Thumbnail URL').first().json;
const isRendered = DELIVERY_MODE === 'rendered';

const sequence = resolved.sequence || [];
const videoIds = sequence
  .map((item) => String(item.videoId || '').trim())
  .filter(Boolean);
const thumbnailUrl = String(oembed.thumbnail_url_with_play_button || '').trim();

let renderJobId = '';
let renderStatusUrl = '';

if (isRendered) {
  const renderResult = $(RENDER_NODE_NAME).first().json;
  renderJobId = String(renderResult.jobId || '').trim();

  if (!renderJobId) {
    throw new Error(`No jobId returned by ${RENDER_NODE_NAME}`);
  }

  renderStatusUrl = `${RENDER_STATUS_BASE_URL}/render/jobs/${encodeURIComponent(renderJobId)}`;
} else if (!videoIds.length) {
  throw new Error('No videos provided');
}

const embedUrls = videoIds.map((videoId) =>
  `https://player.vimeo.com/video/${videoId}?autoplay=1&autopause=0&controls=0&keyboard=0&title=0&byline=0&portrait=0`
);

const mediaMarkup = isRendered
  ? '<video id="video" playsinline preload="metadata"></video>'
  : '<div id="player"></div>';
const posterMarkup = isRendered
  ? '<div id="poster" class="poster" style="display:none"></div>'
  : '<div id="poster" class="poster"></div>';
const videoToggleMarkup = '<button id="videoToggle" class="video-toggle" type="button" aria-label="Pause video" hidden></button>';

const vimeoApiScript = isRendered
  ? ''
  : '<script src="https://player.vimeo.com/api/player.js"></script>';

const clientScript = `
    const deliveryMode = ${JSON.stringify(DELIVERY_MODE)};
    const embedUrls = ${JSON.stringify(embedUrls)};
    const renderJobId = ${JSON.stringify(renderJobId)};
    const renderStatusUrl = ${JSON.stringify(renderStatusUrl)};
    const AUDIO_PREFERENCE_KEY = 'rsc-video-audio-enabled';

    let index = 0;
    let player;
    let shouldPlayWithAudio = false;

    try {
      shouldPlayWithAudio = window.sessionStorage.getItem(AUDIO_PREFERENCE_KEY) === 'true';
    } catch {
      shouldPlayWithAudio = false;
    }

    const poster = document.getElementById('poster');
    const videoElement = document.getElementById('video');
    const videoToggle = document.getElementById('videoToggle');
    const progressPanel = document.getElementById('progressPanel');
    const progressBar = document.getElementById('progressBar');
    const progressLabel = document.getElementById('progressLabel');
    const progressStage = document.getElementById('progressStage');

    function rememberAudioPreference(muted, volume) {
      if (muted === false && Number(volume || 0) > 0) {
        shouldPlayWithAudio = true;
        try {
          window.sessionStorage.setItem(AUDIO_PREFERENCE_KEY, 'true');
        } catch {}
      }
    }

    function showReplay() {
      hideVideoToggle();
    }

    function updateProgress(data) {
      const percentage = Math.max(0, Math.min(100, Number(data.percentage || 0)));
      progressBar.value = percentage;
      progressLabel.textContent = percentage + '%';
      progressStage.textContent = data.stage || 'Preparing video';
    }

    async function pollRenderJob() {
      while (true) {
        const response = await fetch(renderStatusUrl, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          throw new Error('Could not read render progress');
        }

        const data = await response.json();
        updateProgress(data);

        if (data.status === 'complete' && data.videoUrl) {
          progressPanel.hidden = true;
          videoElement.src = data.videoUrl;
          videoElement.muted = !shouldPlayWithAudio;
          videoElement.load();
          showVideoToggle();
          updateVideoToggle(false);
          videoElement.play().catch(handlePlayFailure);
          return;
        }

        if (data.status === 'error') {
          throw new Error(data.error || 'Video rendering failed');
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    function hidePoster() {
      poster.style.display = 'none';
    }

    function showPoster() {
      poster.style.display = 'block';
    }

    function showVideoToggle() {
      if (videoToggle) {
        videoToggle.hidden = false;
      }
    }

    function hideVideoToggle() {
      if (videoToggle) {
        videoToggle.hidden = true;
      }
    }

    function updateVideoToggle(isPlaying) {
      if (!videoToggle) {
        return;
      }

      videoToggle.setAttribute('aria-label', isPlaying ? 'Pause video' : 'Play video');
    }

    function destroyPlayer() {
      if (!player) {
        return Promise.resolve();
      }

      const activePlayer = player;
      player = null;
      hideVideoToggle();
      return activePlayer.destroy().catch(() => {});
    }

    function handlePlayFailure(error) {
      showPoster();
      console.error(error);
    }

    function mountVimeoPlayer() {
      player = new Vimeo.Player('player', {
        url: embedUrls[index],
        autoplay: true,
        muted: !shouldPlayWithAudio,
        byline: false,
        title: false,
        portrait: false
      });
      showVideoToggle();
      updateVideoToggle(false);

      player.on('play', () => updateVideoToggle(true));
      player.on('pause', () => updateVideoToggle(false));

      player.on('volumechange', (data) => {
        rememberAudioPreference(data.muted, data.volume);
      });

      player.on('ended', () => {
        index += 1;

        if (index < embedUrls.length) {
          destroyPlayer().then(() => {
            mountVimeoPlayer();
            player.play().catch(handlePlayFailure);
          });
        } else {
          destroyPlayer().then(showReplay);
        }
      });
    }

    function startSequence() {
      index = 0;
      hidePoster();
      hideVideoToggle();

      if (deliveryMode === 'rendered') {
        pollRenderJob().catch(handlePlayFailure);
        return;
      }

      destroyPlayer().then(() => {
        mountVimeoPlayer();
        player.play().catch(handlePlayFailure);
      });
    }

    if (videoElement) {
      videoElement.addEventListener('play', () => updateVideoToggle(true));
      videoElement.addEventListener('pause', () => updateVideoToggle(false));

      videoElement.addEventListener('volumechange', () => {
        rememberAudioPreference(videoElement.muted, videoElement.volume);
      });

      videoElement.addEventListener('ended', showReplay);
    }

    poster.addEventListener('click', startSequence);

    if (videoToggle) {
      videoToggle.addEventListener('click', () => {
        if (deliveryMode === 'rendered') {
          const playback = videoElement.paused
            ? videoElement.play()
            : videoElement.pause();
          playback?.catch(handlePlayFailure);
          return;
        }

        const activePlayer = player;

        if (!activePlayer) {
          return;
        }

        activePlayer.getPaused().then((isPaused) => {
          const playback = isPaused ? activePlayer.play() : activePlayer.pause();
          return playback.catch(handlePlayFailure);
        }).catch(handlePlayFailure);
      });
    }

    if (deliveryMode === 'rendered') {
      updateProgress({ percentage: 0, stage: 'Preparing video' });
      pollRenderJob().catch(handlePlayFailure);
    } else {
      startSequence();
    }
`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Video Sequence</title>
  <style>
    :root {
      --text: #f5f1e8;
      --muted: #b8b1a3;
      --accent: #d7a84a;
      --accent-hover: #e6bb67;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at top, rgba(215, 168, 74, 0.16), transparent 32rem),
        linear-gradient(180deg, #0a0a0a 0%, #000 100%);
      color: var(--text);
      font-family: Georgia, "Times New Roman", serif;
    }

    .shell {
      width: min(96vw, 960px);
      display: grid;
      gap: 1rem;
    }

    .frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }

    .poster {
      position: absolute;
      inset: 0;
      background-color: #000;
      background-image: url('${thumbnailUrl}');
      background-size: cover;
      background-position: center;
      z-index: 2;
      cursor: pointer;
    }

    #player,
    #video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    #player iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }

    #video {
      object-fit: contain;
      background: #000;
    }

    .video-toggle {
      position: absolute;
      inset: 0;
      z-index: 3;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
    }

    .video-toggle:focus-visible {
      outline: 3px solid var(--accent);
      outline-offset: -6px;
    }

    .render-progress {
      position: absolute;
      inset: 50% 10% auto;
      z-index: 4;
      transform: translateY(-50%);
      color: #f5f1e8;
      text-align: center;
    }

    .render-progress[hidden] {
      display: none;
    }

    .render-progress progress {
      display: block;
      width: 100%;
      height: 0.75rem;
      margin: 0.75rem 0;
      accent-color: #d7a84a;
    }

  </style>
</head>
<body>
  <div class="shell">
    <div class="frame">
      ${posterMarkup}
      ${mediaMarkup}
      ${videoToggleMarkup}
      <div id="progressPanel" class="render-progress" role="status" aria-live="polite">
        <strong id="progressStage">Preparing video</strong>
        <progress id="progressBar" max="100" value="0"></progress>
        <span id="progressLabel">0%</span>
      </div>
    </div>

  </div>

  ${vimeoApiScript}
  <script>
${clientScript}
  </script>
</body>
</html>`;

return [
  {
    json: {
      html,
      deliveryMode: DELIVERY_MODE,
    },
  },
];
