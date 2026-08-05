// HTML Generator Code node
// Supported delivery modes: "vimeo" and "rendered".
const DELIVERY_MODE = 'vimeo';
const RENDER_NODE_NAME = 'Render Video';

const resolved = $('Call').first().json;
const oembed = $('Get Thumbnail URL').first().json;
const isRendered = DELIVERY_MODE === 'rendered';

const sequence = resolved.sequence || [];
const videoIds = sequence
  .map((item) => String(item.videoId || '').trim())
  .filter(Boolean);
const thumbnailUrl = String(oembed.thumbnail_url_with_play_button || '').trim();

let renderedVideoUrl = '';

if (isRendered) {
  const renderResult = $(RENDER_NODE_NAME).first().json;
  renderedVideoUrl = String(renderResult.videoUrl || '').trim();

  if (!renderedVideoUrl) {
    throw new Error(`No videoUrl returned by ${RENDER_NODE_NAME}`);
  }
} else if (!videoIds.length) {
  throw new Error('No videos provided');
}

const embedUrls = videoIds.map((videoId) =>
  `https://player.vimeo.com/video/${videoId}?autoplay=1&autopause=0&title=0&byline=0&portrait=0`
);

const mediaMarkup = isRendered
  ? '<video id="video" playsinline controls preload="metadata"></video>'
  : '<div id="player"></div>';

const vimeoApiScript = isRendered
  ? ''
  : '<script src="https://player.vimeo.com/api/player.js"></script>';

const clientScript = `
    const deliveryMode = ${JSON.stringify(DELIVERY_MODE)};
    const embedUrls = ${JSON.stringify(embedUrls)};
    const renderedVideoUrl = ${JSON.stringify(renderedVideoUrl)};
    const AUDIO_PREFERENCE_KEY = 'rsc-video-audio-enabled';

    let index = 0;
    let player;
    let shouldPlayWithAudio = false;

    try {
      shouldPlayWithAudio = window.sessionStorage.getItem(AUDIO_PREFERENCE_KEY) === 'true';
    } catch {
      shouldPlayWithAudio = false;
    }

    const replayButton = document.getElementById('replayButton');
    const status = document.getElementById('status');
    const poster = document.getElementById('poster');
    const videoElement = document.getElementById('video');

    function rememberAudioPreference(muted, volume) {
      if (muted === false && Number(volume || 0) > 0) {
        shouldPlayWithAudio = true;
        try {
          window.sessionStorage.setItem(AUDIO_PREFERENCE_KEY, 'true');
        } catch {}
      }
    }

    function updateStatus() {
      status.textContent = deliveryMode === 'rendered'
        ? 'Final video'
        : 'Clip ' + (index + 1) + ' of ' + embedUrls.length;
    }

    function showReplay() {
      status.textContent = 'Sequence complete';
      replayButton.style.display = 'inline-block';
    }

    function hideReplay() {
      replayButton.style.display = 'none';
    }

    function hidePoster() {
      poster.style.display = 'none';
    }

    function showPoster() {
      poster.style.display = 'block';
    }

    function destroyPlayer() {
      if (!player) {
        return Promise.resolve();
      }

      return player.destroy().catch(() => {});
    }

    function handlePlayFailure(error) {
      status.textContent = shouldPlayWithAudio
        ? 'Tap play again to continue with audio'
        : 'Tap play again to start audio';
      showPoster();
      console.error(error);
    }

    function mountVimeoPlayer() {
      updateStatus();

      player = new Vimeo.Player('player', {
        url: embedUrls[index],
        autoplay: true,
        muted: !shouldPlayWithAudio,
        byline: false,
        title: false,
        portrait: false
      });

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

    function startRenderedVideo() {
      updateStatus();
      videoElement.src = renderedVideoUrl;
      videoElement.muted = !shouldPlayWithAudio;
      videoElement.load();
      videoElement.play().catch(handlePlayFailure);
    }

    function startSequence() {
      index = 0;
      hideReplay();
      hidePoster();

      if (deliveryMode === 'rendered') {
        startRenderedVideo();
        return;
      }

      destroyPlayer().then(() => {
        mountVimeoPlayer();
        player.play().catch(handlePlayFailure);
      });
    }

    if (videoElement) {
      videoElement.addEventListener('volumechange', () => {
        rememberAudioPreference(videoElement.muted, videoElement.volume);
      });

      videoElement.addEventListener('ended', showReplay);
    }

    poster.addEventListener('click', startSequence);
    replayButton.addEventListener('click', startSequence);

    startSequence();
    status.textContent = 'Ready to play';
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

    .controls {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 3rem;
    }

    .replay-button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 0.85rem 1.4rem;
      background: var(--accent);
      color: #1b1408;
      font: inherit;
      font-size: 1rem;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease;
      display: none;
    }

    .replay-button:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    .replay-button:active {
      transform: translateY(0);
    }

    .status {
      color: var(--muted);
      font-size: 0.95rem;
      text-align: center;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="frame">
      <div id="poster" class="poster"></div>
      ${mediaMarkup}
    </div>

    <div class="controls">
      <button id="replayButton" class="replay-button" type="button">Replay sequence</button>
    </div>

    <div id="status" class="status"></div>
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
