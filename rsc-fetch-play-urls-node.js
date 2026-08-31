// n8n Code node: "Fetch Play URLs"
// Placed after "Call" (resolver) and before "Get Thumbnail URL" / "CTA Config"
// in the crossfade-streaming workflow. Replaces "Render Video" entirely --
// there's nothing to render, so this fetches playback-optimized Vimeo URLs
// for every clip in the sequence (answers + pitch) instead.
//
// Setup requirement: this workflow's n8n container needs VIMEO_ACCESS_TOKEN
// in its own environment (same token already used by render-service's
// .env, just also added to n8n's). Requires the client's Vimeo plan to
// support the `play` field (confirmed: Pro plan covers this).
//
// Unlike "Render Video" (fire-and-forget async job, doesn't block the
// webhook response), this step's result is embedded directly in the
// returned HTML, so it runs synchronously in the response's critical path
// -- hence fetching all clips in parallel via Promise.all rather than
// looping sequentially.

const VIDEO_WIDTH = 1280;

const resolved = $('Call').first().json;
const sequence = resolved.sequence || [];
const token = $env.VIMEO_ACCESS_TOKEN;

if (!token) {
  throw new Error('VIMEO_ACCESS_TOKEN is not set in this n8n instance\'s environment');
}

async function fetchPlayUrl(videoId) {
  const response = await fetch(`https://api.vimeo.com/videos/${videoId}?fields=play`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
    },
  });

  if (!response.ok) {
    throw new Error(`Vimeo play-field request failed for ${videoId}: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const progressive = data?.play?.progressive || [];

  if (!progressive.length) {
    throw new Error(`No progressive playback files returned for ${videoId}`);
  }

  // Same resolution-selection logic as the render service's getVimeoFile():
  // prefer the smallest rendition that still meets our target width,
  // instead of always the largest, since the browser only ever needs to
  // display at this size.
  const sufficientWidth = progressive
    .filter((file) => Number(file.width || 0) >= VIDEO_WIDTH)
    .sort((a, b) => Number(a.width || 0) - Number(b.width || 0));
  const largestAvailable = [...progressive].sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
  const file = sufficientWidth[0] || largestAvailable[0];

  return file.link;
}

const enrichedSequence = await Promise.all(
  sequence.map(async (item) => ({
    ...item,
    playUrl: await fetchPlayUrl(item.videoId),
  })),
);

return [
  {
    json: {
      ...resolved,
      sequence: enrichedSequence,
    },
  },
];
