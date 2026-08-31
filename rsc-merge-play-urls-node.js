// n8n Code node: "Merge Play URLs"
// Runs after: Call (resolver) -> Split Out (fieldToSplitOut: "sequence")
//   -> HTTP Request ("GET https://api.vimeo.com/videos/{{ $json.videoId }}?fields=play",
//      generic credential / Bearer Auth, the "Vimeo API" credential --
//      same pattern the old "Render Video" node used for the render
//      service's own API key, just Bearer instead of Header). Replaces
//      "Render Video" in this workflow entirely.
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
// Pairs by array INDEX, not by looking up a carried-through videoId field --
// confirmed via a real execution that the HTTP Request node's output
// (v4.4, this instance) replaces the item entirely rather than merging in
// the original input fields, so videoId doesn't survive into $json here.
// Split Out and the per-item HTTP Request both preserve item order, so
// index-pairing against resolved.sequence is reliable regardless.
//
// Also handles the Vimeo response arriving as a stringified JSON blob
// under a `data` field (seen in a real execution when the HTTP Request
// node's Response Format was left on "Autodetect") in addition to the
// expected parsed object directly on `.play`, in case the node's
// "Response Format: JSON" setting isn't applied for any reason.

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

function extractPlayField(itemJson) {
  if (itemJson.play) {
    return itemJson.play;
  }
  // Fallback for the "Autodetect" response-format case: the whole Vimeo
  // response body arrives as a JSON string under `data`.
  if (typeof itemJson.data === 'string') {
    try {
      return JSON.parse(itemJson.data).play;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const resolved = $('Call').first().json;
const sequence = resolved.sequence || [];
const loopedItems = $input.all();

if (loopedItems.length !== sequence.length) {
  throw new Error(
    `Expected ${sequence.length} looped play-URL results (one per clip in sequence), got ${loopedItems.length}`,
  );
}

const enrichedSequence = sequence.map((clip, index) => ({
  ...clip,
  playUrl: pickPlayUrl(extractPlayField(loopedItems[index].json)),
}));

return [
  {
    json: {
      ...resolved,
      sequence: enrichedSequence,
    },
  },
];
