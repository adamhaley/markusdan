// n8n Code node: "Merge Play URLs"
// Runs after: Call (resolver) -> Loop Over Items (over resolved.sequence)
//   -> HTTP Request ("GET https://api.vimeo.com/videos/{{ $json.videoId }}?fields=play",
//      generic credential / HTTP Header Auth, e.g. a new "Vimeo API" credential
//      with Authorization: Bearer <RSC_VIMEO_ACCESS_TOKEN> -- same pattern
//      already used by the "Render Video" node for the render service's own
//      API key). Replaces "Render Video" in this workflow entirely.
//
// n8n's default looped-HTTP-Request execution is sequential, not parallel --
// that's fine here: even 6-7 sequential Vimeo calls (a couple of seconds)
// is comfortably absorbed by the ~12s artificial "generating your results"
// delay the answer page already shows, so there's no need to fight for
// concurrency in the n8n workflow itself.
//
// Set this Code node to "Run Once for All Items" so it receives one input
// item per looped clip and can reassemble them into a single sequence.
//
// IMPORTANT -- verify once wired up in n8n: this assumes each looped item's
// json still carries the original `videoId` field (from the loop's input)
// alongside the HTTP Request node's own response fields. If the HTTP
// Request node's output replaces the item instead of merging with it,
// enable its "include input fields" / similar option, or adjust the
// `videoId` lookup below to match however the loop actually threads it
// through -- not something verifiable without hands-on access to the
// live workflow.

const VIDEO_WIDTH = 1280;

function pickPlayUrl(playField) {
  const progressive = playField?.progressive || [];

  if (!progressive.length) {
    throw new Error('No progressive playback files in Vimeo response');
  }

  // Same selection logic as the old render service's getVimeoFile():
  // prefer the smallest rendition that still meets our target width.
  const sufficientWidth = progressive
    .filter((file) => Number(file.width || 0) >= VIDEO_WIDTH)
    .sort((a, b) => Number(a.width || 0) - Number(b.width || 0));
  const largestAvailable = [...progressive].sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
  const file = sufficientWidth[0] || largestAvailable[0];

  if (!file?.link) {
    throw new Error('No downloadable play link in Vimeo response');
  }

  return file.link;
}

const resolved = $('Call').first().json;
const loopedItems = $input.all();

const playUrlByVideoId = {};
for (const item of loopedItems) {
  const videoId = String(item.json.videoId || '').trim();
  if (!videoId) {
    throw new Error('A looped item is missing videoId -- check the loop is carrying input fields through to the HTTP Request node\'s output');
  }
  playUrlByVideoId[videoId] = pickPlayUrl(item.json.play);
}

const enrichedSequence = (resolved.sequence || []).map((clip) => ({
  ...clip,
  playUrl: playUrlByVideoId[clip.videoId],
}));

const missing = enrichedSequence.find((clip) => !clip.playUrl);
if (missing) {
  throw new Error(`No play URL resolved for clip: ${missing.label}`);
}

return [
  {
    json: {
      ...resolved,
      sequence: enrichedSequence,
    },
  },
];
