const answers = $('Webhook').first().json.query;
const vimeoMap = $('vimeo-mapping').first().json;


function toAnswerKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const match = normalized.match(/^(\d+)([a-z])$/);

  if (!match) {
    throw new Error(`Invalid answer format: ${value}`);
  }

  return `answer-${match[1]}${match[2]}`;
}

const selections = [1, 2, 3].map((questionNumber) => {
  const rawAnswer = answers[`q${questionNumber}`];
  const answerKey = toAnswerKey(rawAnswer);
  const video = vimeoMap[answerKey];

  if (!video) {
    throw new Error(`No Vimeo mapping found for ${answerKey}`);
  }

  return {
    questionNumber,
    rawAnswer,
    answerKey,
    video,
  };
});

return [
  {
    json: {
      selections,
      video1: selections[0].video,
      video2: selections[1].video,
      video3: selections[2].video,
    },
  },
];

// HTML Generator Code node
// Input: { selections: [{ questionNumber, rawAnswer, answerKey, video }] }
const selections = $('Parse Answers').first().json.selections;
const oembed = $('HTTP Request').first().json;

const videoPaths = (selections || [])
  .map((item) => String(item.video || '').trim())
  .filter(Boolean);
const thumbnailUrl = String(oembed.thumbnail_url || '').trim();

if (!videoPaths.length) {
  throw new Error('No videos provided');
}

const embedUrls = videoPaths.map((path) => {
  const [videoId, hash] = path.split('/');

  if (!videoId || !hash) {
    throw new Error(`Invalid Vimeo mapping value: ${path}`);
  }

  return `https://player.vimeo.com/video/${videoId}?h=${hash}&autopause=0&title=0&byline=0&portrait=0`;
});


// HTML Generator Code node
// Input: { selections: [{ questionNumber, rawAnswer, answerKey, video }] }
const selections = $('Parse Answers').first().json.selections;
const oembed = $('Get Thumbnail URL').first().json;

const videoPaths = (selections || [])
  .map((item) => String(item.video || '').trim())
  .filter(Boolean);
const thumbnailUrl = String(oembed.thumbnail_url_with_play_button || '').trim();

if (!videoPaths.length) {
  throw new Error('No videos provided');
}

const embedUrls = videoPaths.map((path) => {
  const [videoId, hash] = path.split('/');

  if (!videoId || !hash) {
    throw new Error(`Invalid Vimeo mapping value: ${path}`);
  }

  return `https://player.vimeo.com/video/${videoId}?h=${hash}&autoplay=1&autopause=0&title=0&byline=0&portrait=0`;
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Video Sequence</title>
  <style>
    :root {
      --bg: #050505;
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

    #player {
      position: relative;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    #player iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      pointer-events: auto;
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
      transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
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
      <div id="player"></div>
    </div>

    <div class="controls">
      <button id="replayButton" class="replay-button" type="button">Replay sequence</button>
    </div>

    <div id="status" class="status"></div>
  </div>

  <script src="https://player.vimeo.com/api/player.js"></script>
  <script>
    const embedUrls = ${JSON.stringify(embedUrls)};
    let index = 0;
    let player;

    const replayButton = document.getElementById('replayButton');
    const status = document.getElementById('status');
    const poster = document.getElementById('poster');

    function updateStatus() {
      status.textContent = 'Clip ' + (index + 1) + ' of ' + embedUrls.length;
    }

    function showReplay() {
      status.textContent = 'Sequence complete';
      replayButton.style.display = 'inline-block';
    }

    function hideReplay() {
      replayButton.style.display = 'none';
    }

    function hideStart() {
      return;
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

    function mountPlayer() {
      updateStatus();

      player = new Vimeo.Player('player', {
        url: embedUrls[index],
        autoplay: true,
        muted: true,
        byline: false,
        title: false,
        portrait: false
      });

      player.on('ended', () => {
        index += 1;

        if (index < embedUrls.length) {
          destroyPlayer().then(() => {
            mountPlayer();
            player.play().catch(() => {});
          });
        } else {
          destroyPlayer().then(() => {
            showReplay();
          });
        }
      });
    }

    function startSequence() {
      index = 0;
      hideStart();
      hideReplay();
      hidePoster();
      destroyPlayer().then(() => {
        mountPlayer();
        player.play().catch((error) => {
          status.textContent = 'Tap play again to start audio';
          showPoster();
          console.error(error);
        });
      });
    }

    poster.addEventListener('click', () => {
      startSequence();
    });

    replayButton.addEventListener('click', () => {
      startSequence();
    });
    hidePoster();
    startSequence();
    status.textContent = 'Ready to play';
  </script>
</body>
</html>`;

return [{ json: { html } }];

