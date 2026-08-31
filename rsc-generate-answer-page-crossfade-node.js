// HTML Generator Code node -- crossfade-streaming workflow.
// Replaces rsc-generate-answer-page-node.js's "rendered" delivery mode
// entirely: nothing is server-rendered anymore. Every clip (answers +
// pitch) streams directly from Vimeo via its `play`-field URL (fetched by
// the "Fetch Play URLs" node upstream) and is crossfaded client-side with
// two stacked <video> elements. Validated locally against real project
// clips before this was built -- see the crossfade POC referenced in the
// 2026-08-31 planning notes.
const PLAY_URLS_NODE_NAME = 'Merge Play URLs';
const PROGRESS_MESSAGE = 'Ihre individuelle Auswertung wird in Echtzeit erstellt.\nBitte um einen Moment Geduld. Es zahlt sich aus.';
// Deliberately artificial -- there's no render step left to wait for, but
// the client specifically wants this pacing kept (DEH-31 origin): an
// instant reveal reads as less "custom-built for you" than a short
// build-up does. Unconditional now; there's no cache-hit/miss distinction
// left to key it off.
const GENERATING_DELAY_MS = 12000;
// How long to wait for the next clip to report itself ready to play
// smoothly before starting its crossfade anyway. Preloading starts right
// after the previous swap (each clip runs 1-2 min, so there's normally
// plenty of lead time) -- this timeout only matters on a slow connection
// where that isn't enough, and starting anyway beats hanging indefinitely.
const CLIP_READY_TIMEOUT_MS = 4000;
const CROSSFADE_MS = 350;

const PITCH_LETTERS = {
  pitch_a_bank: 'A',
  pitch_b_life_insurance: 'B',
  pitch_c_everything_else: 'C',
  pitch_d_broke: 'D',
};

// DEH-38: pitch B gets fixed heading text above its CTA buttons.
const PITCH_HEADING_OVERRIDES = {
  pitch_b_life_insurance:
    '<strong>Schnell-Check mit Kontaktdaten wiederholen – nur Fragen, kein Video.</strong><br>\n' +
    '<strong>Auswertung per E-Mail und persönliche Analyse am Telefon.</strong>',
};

const ctaConfig = $('CTA Config').first().json;

const resolved = $(PLAY_URLS_NODE_NAME).first().json;
const oembed = $('Get Thumbnail URL').first().json;

const pitchKey = String(resolved.pitchKey || '').trim();
const cta = ctaConfig[pitchKey] || null;

const normalizedAnswers = resolved.normalizedAnswers || {};
const answerScores = [1, 2, 3, 4, 5, 6]
  .map((step) => {
    const code = String(normalizedAnswers[step] || '').trim();
    const letter = code.slice(-1).toLowerCase();
    const score = letter.charCodeAt(0) - 'a'.charCodeAt(0);
    return Number.isFinite(score) && score >= 0 ? score : 0;
  })
  .join('');
const pitchLetter = PITCH_LETTERS[pitchKey] || '';
const trackingCode = `${answerScores}${pitchLetter}`;

const sequence = resolved.sequence || [];
const clips = sequence
  .map((item) => ({ label: String(item.label || ''), url: String(item.playUrl || '').trim() }))
  .filter((clip) => clip.url);

if (!clips.length) {
  throw new Error('No playable clips provided');
}

const thumbnailUrl = String(oembed.thumbnail_url_with_play_button || '').trim();

const ctaHeading = PITCH_HEADING_OVERRIDES[pitchKey] || cta?.heading;

const ctaMarkup = cta
  ? `<div id="ctaPanel" class="cta-panel" hidden>
      ${ctaHeading ? `<p class="cta-heading">${ctaHeading}</p>` : ''}
      <div class="cta-buttons">
        ${cta.buttons.map((button) => {
          const href = String(button.href || '').replace('xxxxxx', trackingCode);
          return `<a class="cta-button" href="${href}">${button.label}</a>`;
        }).join('\n        ')}
      </div>
    </div>`
  : '';

const clientScript = `
    const clips = ${JSON.stringify(clips)};
    const GENERATING_DELAY_MS = ${JSON.stringify(GENERATING_DELAY_MS)};
    const CLIP_READY_TIMEOUT_MS = ${JSON.stringify(CLIP_READY_TIMEOUT_MS)};
    const CROSSFADE_MS = ${JSON.stringify(CROSSFADE_MS)};
    const AUDIO_PREFERENCE_KEY = 'rsc-video-audio-enabled';

    let shouldPlayWithAudio = false;

    const ctaPanel = document.getElementById('ctaPanel');

    function showCta() {
      if (ctaPanel) {
        ctaPanel.hidden = false;
      }
    }

    try {
      shouldPlayWithAudio = window.sessionStorage.getItem(AUDIO_PREFERENCE_KEY) === 'true';
    } catch {
      shouldPlayWithAudio = false;
    }

    const poster = document.getElementById('poster');
    const videoA = document.getElementById('videoA');
    const videoB = document.getElementById('videoB');
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

    function updateProgress(percentage) {
      const clamped = Math.max(0, Math.min(100, percentage));
      progressBar.value = clamped;
      progressLabel.textContent = clamped + '%';
      progressStage.textContent = ${JSON.stringify(PROGRESS_MESSAGE)};
    }

    async function runFakeProgress(durationMs) {
      const stepMs = 500;
      const steps = Math.max(1, Math.round(durationMs / stepMs));

      for (let step = 1; step <= steps; step += 1) {
        await new Promise((resolve) => setTimeout(resolve, stepMs));
        updateProgress(Math.round((step / steps) * 100));
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

    function handlePlayFailure(error) {
      showPoster();
      console.error(error);
    }

    // readyState >= 3 (HAVE_FUTURE_DATA) means it can play forward smoothly
    // without immediately stalling for more data.
    function waitUntilReady(videoEl) {
      if (videoEl.readyState >= 3) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          videoEl.removeEventListener('canplay', finish);
          resolve();
        };
        videoEl.addEventListener('canplay', finish);
        setTimeout(finish, CLIP_READY_TIMEOUT_MS);
      });
    }

    let front = videoA;
    let back = videoB;
    let clipIndex = 0;
    let crossfading = false;
    let crossfadeTriggered = false;

    function loadInto(videoEl, clip) {
      videoEl.src = clip.url;
      videoEl.load();
    }

    async function startCrossfade() {
      if (crossfading) return;
      crossfading = true;
      if (videoToggle) videoToggle.disabled = true;

      const nextIndex = clipIndex + 1;
      if (nextIndex >= clips.length) {
        crossfading = false;
        if (videoToggle) videoToggle.disabled = false;
        console.log('[RSC] Sequence complete after clip ' + (clipIndex + 1) + '/' + clips.length + ' ("' + clips[clipIndex].label + '")');
        return;
      }

      console.log('[RSC] Crossfade starting: clip ' + (clipIndex + 1) + '/' + clips.length + ' ("' + clips[clipIndex].label + '") -> clip ' + (nextIndex + 1) + '/' + clips.length + ' ("' + clips[nextIndex].label + '")');

      await waitUntilReady(back);
      back.currentTime = 0;
      back.muted = !shouldPlayWithAudio;
      try { await back.play(); } catch (e) { console.error('back.play() failed', e); }

      const start = performance.now();
      await new Promise((resolve) => {
        function step(now) {
          // Clamp both ends: requestAnimationFrame's timestamp can land a
          // hair before a performance.now() call made moments earlier (a
          // real, documented browser timing quirk), making the first
          // frame's (now - start) slightly negative. Un-clamped, that
          // pushed (1 - t) past 1 and threw when assigned to .volume
          // (which requires [0, 1]) - an uncaught exception that killed
          // the animation loop mid-frame, so it never scheduled another
          // frame or resolved the crossfade's promise. That's what looked
          // like a permanent freeze.
          //
          // The try/catch below is a second line of defense against the
          // same failure shape from any other cause: whatever throws, still
          // finish the crossfade (jump straight to the end state) instead
          // of leaving this promise pending forever and silently freezing
          // the whole sequence with no visible error to the visitor.
          try {
            const t = Math.max(0, Math.min(1, (now - start) / CROSSFADE_MS));
            front.style.opacity = String(1 - t);
            back.style.opacity = String(t);
            front.volume = shouldPlayWithAudio ? 1 - t : 0;
            back.volume = shouldPlayWithAudio ? t : 0;
            if (t < 1) {
              requestAnimationFrame(step);
            } else {
              resolve();
            }
          } catch (e) {
            console.error('[RSC] Crossfade animation frame failed, finishing transition immediately', e);
            front.style.opacity = '0';
            back.style.opacity = '1';
            front.volume = 0;
            back.volume = shouldPlayWithAudio ? 1 : 0;
            resolve();
          }
        }
        requestAnimationFrame(step);
      });

      front.pause();

      const oldFront = front;
      front = back;
      back = oldFront;
      clipIndex = nextIndex;
      crossfadeTriggered = false;
      crossfading = false;
      if (videoToggle) videoToggle.disabled = false;

      console.log('[RSC] Now on clip ' + (clipIndex + 1) + '/' + clips.length + ' ("' + clips[clipIndex].label + '")');

      const followIndex = clipIndex + 1;
      if (followIndex < clips.length) {
        back.style.opacity = '0';
        back.volume = 0;
        loadInto(back, clips[followIndex]);
        console.log('[RSC] Preloading clip ' + (followIndex + 1) + '/' + clips.length + ' ("' + clips[followIndex].label + '") in background');
      }
    }

    function onTimeUpdate() {
      if (crossfading || crossfadeTriggered) return;
      const seconds = CROSSFADE_MS / 1000;
      if (front.duration && front.currentTime >= front.duration - seconds) {
        crossfadeTriggered = true;
        startCrossfade();
      }
    }

    videoA.addEventListener('timeupdate', () => { if (front === videoA) onTimeUpdate(); });
    videoB.addEventListener('timeupdate', () => { if (front === videoB) onTimeUpdate(); });
    videoA.addEventListener('play', () => { if (front === videoA) updateVideoToggle(true); });
    videoB.addEventListener('play', () => { if (front === videoB) updateVideoToggle(true); });
    videoA.addEventListener('pause', () => { if (front === videoA) updateVideoToggle(false); });
    videoB.addEventListener('pause', () => { if (front === videoB) updateVideoToggle(false); });
    videoA.addEventListener('volumechange', () => rememberAudioPreference(videoA.muted, videoA.volume));
    videoB.addEventListener('volumechange', () => rememberAudioPreference(videoB.muted, videoB.volume));

    function handleSequenceEnded() {
      if (clipIndex === clips.length - 1) {
        hideVideoToggle();
        showCta();
      }
    }
    videoA.addEventListener('ended', () => { if (front === videoA) handleSequenceEnded(); });
    videoB.addEventListener('ended', () => { if (front === videoB) handleSequenceEnded(); });

    if (videoToggle) {
      videoToggle.addEventListener('click', () => {
        if (crossfading) return;
        const playback = front.paused ? front.play() : front.pause();
        playback?.catch(handlePlayFailure);
      });
    }

    async function start() {
      hidePoster();
      hideVideoToggle();
      updateProgress(0);

      // Both videos start invisible -- otherwise the "front" clip's own
      // first frame becomes visible as soon as it buffers enough to decode
      // one (well before the generating delay finishes or play() is ever
      // called), which reads as a stray thumbnail sitting under the
      // progress overlay. Revealed only once playback actually starts,
      // below.
      front.style.opacity = '0';
      back.style.opacity = '0';

      loadInto(front, clips[0]);
      if (clips.length > 1) {
        loadInto(back, clips[1]);
      }

      await Promise.all([
        runFakeProgress(GENERATING_DELAY_MS),
        waitUntilReady(front),
      ]);

      progressPanel.hidden = true;
      front.muted = !shouldPlayWithAudio;
      try {
        await front.play();
        // Only reveal front here, once playback has actually begun -- back
        // stays at 0 until a crossfade explicitly sets it (same reasoning
        // as above: it's preloaded well ahead of time and would otherwise
        // paint over front, since it's later in DOM order at the same
        // z-index).
        front.style.opacity = '1';
        console.log('[RSC] Sequence started: ' + clips.length + ' clips total. Now on clip 1/' + clips.length + ' ("' + clips[0].label + '")');
        showVideoToggle();
        updateVideoToggle(true);
      } catch (e) {
        handlePlayFailure(e);
      }
    }

    poster.addEventListener('click', start);
    start().catch(handlePlayFailure);
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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

    #videoA,
    #videoB {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      z-index: 1;
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

    .render-progress strong {
      display: block;
      white-space: pre-line;
      text-wrap: balance;
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

    .cta-panel {
      position: absolute;
      inset: 0;
      z-index: 4;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 0.75rem;
      text-align: center;
      padding: 1.5rem;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.72) 100%);
    }

    .cta-panel[hidden] {
      display: none;
    }

    .cta-heading {
      margin: 0;
      font-size: 1.1rem;
      color: var(--text);
    }

    .cta-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
    }

    .cta-button {
      display: inline-block;
      padding: 0.6rem 1.4rem;
      border-radius: 0;
      background: var(--accent);
      color: #1a1305;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-decoration: none;
      font-weight: bold;
      transition: background 0.15s ease;
    }

    .cta-button:hover {
      background: var(--accent-hover);
    }

  </style>
</head>
<body>
  <div class="shell">
    <div class="frame">
      <div id="poster" class="poster" style="display:none"></div>
      <video id="videoA" playsinline preload="auto"></video>
      <video id="videoB" playsinline preload="auto"></video>
      <button id="videoToggle" class="video-toggle" type="button" aria-label="Pause video" hidden></button>
      <div id="progressPanel" class="render-progress" role="status" aria-live="polite">
        <strong id="progressStage">${PROGRESS_MESSAGE}</strong>
        <progress id="progressBar" max="100" value="0"></progress>
        <span id="progressLabel">0%</span>
      </div>
      ${ctaMarkup}
    </div>
  </div>

  <script>
${clientScript}
  </script>
</body>
</html>`;

return [
  {
    json: {
      html,
    },
  },
];
