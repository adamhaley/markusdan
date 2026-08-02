# Risk Fast Check Server-Side Render Plan

## Goal

Move from the current HTML/Vimeo sequence prototype toward server-side rendered final videos while inducing as little tech debt as possible.

Phase one status as of 2026-08-02:

- static quiz prototype is working end to end
- `n8n` resolver / wrapper / test harness split is in place
- final webhook response renders the generated answer page in-browser
- audio preference persists across quiz steps and into the final answer sequence
- resolver now returns canonical `sequence` output suitable for a downstream render contract

## Recommended Path

1. Freeze the resolver contract.
   - Keep the inner resolver workflow as the single source of truth for answer normalization, answer-clip resolution, pitch resolution, and final sequence ordering.
   - Do not let rendering logic leak back into it.

2. Return a canonical final sequence.
   - The resolver should return the final ordered sequence explicitly, including the final pitch clip.
   - Every downstream delivery path should consume this sequence instead of reconstructing it.

3. Add rendering as a separate downstream workflow.
   - Do not rewrite the existing logic flow.
   - Prefer a small render API hosted on the same server as self-hosted `n8n`.
   - Let `n8n` call that render API.
   - Build a render wrapper workflow that:
     - calls the resolver
     - checks cache
     - calls the render API on miss
     - stores or reuses output
     - returns a public URL

4. Use `ffmpeg` first.
   - The current need is clip concatenation plus a final pitch clip.
   - `ffmpeg` is the lower-debt tool for that than Remotion.
   - Remotion should remain optional until there is a real need for overlays, transitions, or more advanced composition.

5. Add caching immediately.
   - Generate a deterministic `comboKey` from the resolved answers plus pitch.
   - Use it for cache lookup and output filenames.
   - First request renders.
   - Later requests reuse the stored result.

6. Keep business logic and media plumbing separate.
   - Resolver owns clip selection.
   - Render workflow owns file lookup, download/local access, and stitching.
   - Avoid mixing the spreadsheet / answer logic with media pipeline details.

7. Test in layers.
   - Resolver tests:
     - normalized answers
     - pitch selection
     - final ordered sequence
   - Render smoke tests later:
     - output file exists
     - duration is plausible
     - sequence completeness looks correct

8. Delay operational complexity.
   - Start with filesystem cache and deterministic filenames.
   - Add a DB or render-tracking layer only if operations become painful.

## Recommended Deployment Split

- Cloudflare Pages
  - static quiz frontend only
- Self-hosted MEGYK server
  - `n8n`
  - render API
  - local temp render workspace
  - public rendered MP4 output path

The browser should keep talking to `n8n`.
`n8n` should talk to the render API.
The render API should return a `videoUrl`, not raw MP4 bytes through `n8n`.

## Recommended Render Contract

The render API should consume the resolver's canonical `sequence` output directly.

Example request:

```json
{
  "sequence": [
    {
      "type": "answer",
      "order": 1,
      "label": "RSCL_A1c_100k-500k",
      "videoId": "1206983457"
    },
    {
      "type": "pitch",
      "order": 7,
      "label": "RSCL_Pitch_C_Everything_Else",
      "videoId": "1207155801"
    }
  ],
  "metadata": {
    "pitchKey": "pitch_c_everything_else",
    "normalizedAnswers": {
      "1": "1c",
      "2": "2a",
      "3": "3a",
      "4": "4a",
      "5": "5a",
      "6": "6a"
    }
  }
}
```

Example response:

```json
{
  "ok": true,
  "renderId": "20260802-abc123",
  "videoUrl": "https://megyk.com/renders/20260802-abc123.mp4"
}
```

## Recommended Service Stack

- `Node.js`
- `Express`
- Vimeo API personal access token
- local disk temp storage
- `ffmpeg` via child process

This is preferred over Flask or a larger web framework because the job is narrow, JSON-oriented, and already adjacent to a JavaScript-heavy orchestration layer.

## Proposed Workflow Split

- Resolver workflow
  - pure business logic

- Webhook / HTML prototype workflow
  - calls resolver
  - gets thumbnail
  - returns Vimeo sequence page

- Render API
  - accepts canonical `sequence`
  - downloads Vimeo clips
  - stitches clips with `ffmpeg`
  - writes output to public local storage
  - returns `videoUrl`

- Render Video workflow
  - thin `n8n` wrapper around the render API
  - owns orchestration, not media assembly

- Test Harness workflow
  - fixture-based assertions against resolver
  - later render smoke tests

## Why This Minimizes Tech Debt

- No premature Express / Next.js rewrite
- No duplicated decision logic
- Current prototype path remains usable
- Future render path can swap in without changing the resolver
- Remotion stays optional instead of becoming foundational too early

## Immediate Next Steps

1. Finalize the resolver output contract.
2. Keep `sequence` as the stable render boundary.
3. Paste the hardened harness node sources into live `n8n` and verify the test workflow there.
4. Build a minimal render API proof of concept:
   - fixed request
   - fetch Vimeo clips
   - concatenate with `ffmpeg`
   - return public `videoUrl`
5. Wire `n8n` to call the render API only after the proof succeeds.
6. Defer Remotion unless `ffmpeg` proves insufficient for actual presentation needs.
