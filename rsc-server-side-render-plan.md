# Risk Fast Check Server-Side Render Plan

## Goal

Move from the current HTML/Vimeo sequence prototype toward server-side rendered final videos while inducing as little tech debt as possible.

## Recommended Path

1. Freeze the resolver contract.
   - Keep the inner resolver workflow as the single source of truth for answer normalization, answer-clip resolution, pitch resolution, and final sequence ordering.
   - Do not let rendering logic leak back into it.

2. Return a canonical final sequence.
   - The resolver should return the final ordered sequence explicitly, including the final pitch clip.
   - Every downstream delivery path should consume this sequence instead of reconstructing it.

3. Add rendering as a separate downstream workflow.
   - Do not rewrite the existing logic flow.
   - Build a render wrapper workflow that:
     - calls the resolver
     - checks cache
     - renders on miss
     - stores the output
     - returns a file path or public URL

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

## Proposed Workflow Split

- Resolver workflow
  - pure business logic

- Webhook / HTML prototype workflow
  - calls resolver
  - gets thumbnail
  - returns Vimeo sequence page

- Render Video workflow
  - calls resolver
  - stitches clips with `ffmpeg`
  - caches final output

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
2. Ensure the canonical `sequence` is returned directly.
3. Finish and trust the resolver test harness.
4. Build the first `ffmpeg` render workflow after the resolver is stable.
5. Defer Remotion unless `ffmpeg` proves insufficient for actual presentation needs.
