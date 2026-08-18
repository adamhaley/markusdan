# Risk-Fast-Check → OptimizePress integration: investigation notes

Date: 2026-08-16
Status: pre-access investigation. Nothing here is confirmed against a real
OptimizePress (OP3) environment — treat every item below as "needs to be
verified once we're in," not as a known fact.

## Context

The client wants to explore moving the Risk-Fast-Check quiz (currently
static HTML/CSS/JS hosted separately, `riskfastcheck_clean/`) directly into
his WordPress site, built with the OptimizePress (OP3) page builder. His
mental model: copy the quiz body HTML into an OP3 page/HTML block, keep the
header/footer as OP3's native site chrome (not ours), and paste the custom
JS/CSS into fields OP3 exposes for that. Two things are driving this:

1. It looks like the "easy" way to get the quiz living on his own domain
   under his own site, rather than a separate Cloudflare-hosted subdomain.
2. He expects it would automatically plug into OptimizePress's existing
   analytics/conversion tracking on the backend, which matters to him.

Neither of these is unreasonable to want, but there's more technical surface
area here than "paste HTML into a box." This doc lays out what's likely to
go wrong, what's already been fixed proactively, and what needs to be
checked the moment WordPress access exists.

## Architecture recap (why this matters)

- Each quiz step is its own static HTML file (`schritt-1.html` … `schritt-7.html`),
  navigated between via full-page `window.location.href` redirects driven by
  `data-next`/`data-prev` attributes — not a single-page app.
- Answers are held in `sessionStorage` (`assets/form.js`), not submitted
  incrementally — only the final step POSTs the full payload.
- The final step POSTs to an n8n webhook
  (`https://n8n.megyk.com/webhook/fe28dcfc-...`), which returns a complete
  HTML document (the rendered video/answer page). The client-side JS then
  does `document.open(); document.write(html); document.close();` —
  an atomic full-document replace of whatever page it was just on.
- A separate step-video renderer fetches `assets/steps.json` (relative URL)
  to look up per-step Vimeo IDs.

## What's already confirmed safe (checked directly, no WP access needed)

**CORS is not a blocker.** Tested both backend endpoints directly:

```
OPTIONS https://n8n.megyk.com/webhook/fe28dcfc-b0d2-4c67-b447-c5225b82f8dd
  Origin: https://markusdan.com        → access-control-allow-origin: https://markusdan.com
  Origin: https://example-random.com   → access-control-allow-origin: https://example-random.com
```

The submit webhook reflects back *whatever* Origin it's sent — it's
already wide open, not scoped to the current Cloudflare-hosted domain. No
n8n-side change needed to call it from `markusdan.com`.

```
GET https://renders.megyk.com/render/jobs/test
  access-control-allow-origin: *
```

The render-status polling endpoint is also fully open. So: wherever this
JS ends up running from, the webhook calls will work.

## Risks, ranked by how likely they are to actually bite

### 1. WordPress may strip the `<form>`/`<script>` tags on save (highest priority to test)

WordPress runs page/post content through `wp_kses_post()` for any editor
account that lacks the `unfiltered_html` capability (only Administrators
have it by default on a single-site install). That filter silently deletes
`<form>`, `<script>`, `<style>`, and `<iframe>` tags — the content saves
without error, previews fine in some contexts, and only fails on the live
page. Whether OP3's own "HTML/Code" block bypasses this (some builders
store code-field content in a way that skips core content filters, but this
isn't guaranteed) is unknown without testing.

**First thing to test with real access:** paste a trivial
`<form><input><script>console.log('ok')</script></form>` snippet into
whatever block/field is being used, save, reload, and inspect the rendered
DOM (not the editor) to confirm both tags survived. If the account isn't an
Administrator, ask the client for one that is, or ask whether OP3's code
block is documented as exempt from content filtering.

### 2. The custom JS/CSS fields the client showed may be site-wide, not page-scoped

If those fields inject globally (a common pattern for page-builder "Custom
CSS/JS" settings), our original `form.css` — with bare `body`, `.button`,
`.card`, `.error`, `input[type=...]` selectors and `:root`-level CSS custom
properties like `--text`, `--accent`, `--muted` — would apply across the
*entire* WordPress site, not just the quiz page. Real risk of visually
breaking other pages on first paste.

**Mitigated already (see "Hardening done" below).**

### 3. Global JS scope pollution

`form.js` declared everything as top-level `function`/`const`
(`getState`, `saveField`, `init`, …). If the custom-JS field executes in
the page's shared global scope alongside WordPress core, other plugins,
and OP3's own scripts, there's a real chance of a name collision with some
other plugin's global.

**Mitigated already (see below).**

### 4. Relative asset paths will break under WP's URL structure

`STEP_CONFIG_PATH = "assets/steps.json?v=..."` and the `form.css` `<link>`
are relative URLs, resolved against whatever URL the page lives at. Today
that's flat filenames (`schritt-1.html`) so it works. Under OP3 the page will
live at some WP-generated slug (e.g. `/risk-fast-check/schritt-1/`), and a
relative path will 404. These need to become absolute URLs before porting —
either pointing back at the current Cloudflare-hosted `assets/` folder
(fastest, keeps one source of truth), or uploaded into the WP media
library with the paths updated to match.

**Not yet done** — depends on knowing the real hosting destination for
`assets/`, which we won't know until there's a concrete plan for where
those files live under WP.

### 5. Inter-step navigation is hardcoded filenames, not portable

`data-next="schritt-2.html"` drives `window.location.href` on every step.
Under OP3 each step becomes its own page with its own WP-assigned URL —
every `data-next`/`data-prev` attribute across all 7 steps needs to be
rewritten by hand to match whatever URL structure OP3 gives the new pages.
Mechanical, but can't be done until those URLs exist.

### 6. The final "swap to rendered video" step still loses whatever chrome wraps it

After the last step submits, `document.write(html)` performs an atomic
full-document replace with whatever HTML the n8n webhook returns (the video
player). That erases the *entire* current DOM — including any real WP
header/footer that page would have had. This is exactly what happens
today (there's no WP chrome to lose currently), so nothing regresses — but
if part of the motivation for moving to OP3 is "real site chrome
everywhere, including the final step," this mechanism defeats that
specific goal. Worth a conscious call with the client rather than
discovering it after the fact. Fixing it would mean redesigning how the
final page is delivered (e.g. navigating to a real URL instead of an
in-place document swap) — out of scope unless he decides it matters.

### 7. OptimizePress's own analytics/conversion tracking likely won't "just work" for a pasted-in form

This directly addresses the client's second assumption, so it's worth
being explicit: **plugging into his existing stats is only partially
true, and the part that probably won't work is the part he likely cares
about most.**

- Basic page-level traffic (visits, time on page, GTM/Meta Pixel events
  that fire on page load regardless of content) — this will keep working,
  since it's tied to the page itself, not to specific elements on it.
- OP3's funnel-specific tracking — step-by-step conversion/drop-off
  stats, "goal" tracking tied to its own Button/Form elements — is almost
  certainly wired to elements OP3 renders itself (its own button/form
  components carry `data-op-action`, `data-op3-*` attributes and have
  OP3's own JS listening for clicks on them). A raw `<form>` pasted into
  an HTML/Code block is invisible to that tracking layer by default. OP3
  has no way to know our custom form was submitted or which step a visitor
  is on unless we tell it to.
- **Unknown, needs checking once we have access:** whether OP3 exposes a
  documented JS API or event hook to manually fire a "conversion" event
  for custom code (many funnel builders do provide something like this —
  worth searching their docs/admin for terms like "custom conversion
  tracking," "goal tracking API," or similar). If it exists, we could call
  it manually from `form.js` at the right moments (step completed, final
  submit). If it doesn't, the client should know upfront that the
  step-by-step funnel visibility he's expecting from OptimizePress won't
  materialize just by embedding the HTML — it would need either a manual
  integration with OP3's tracking API (if one exists) or a parallel
  analytics setup (e.g. our own GTM events) to get equivalent visibility.

## Hardening done now (2026-08-16), independent of whether OP3 happens

Two of the risks above (#2 and #3) are safe, mechanical changes worth
making regardless of the OP3 decision, so they're already done:

- **CSS scoping** — every selector in `assets/form.css` is now prefixed
  with a single `.rsc-quiz` class (including the former `:root` custom
  properties, which are now scoped to `.rsc-quiz` instead of leaking
  globally). The class is applied to `<body class="rsc-quiz">` on all 7
  step pages. Nothing in the file can leak outside that subtree even if it
  ends up in a genuinely global "site-wide custom CSS" field.
- **JS scope isolation** — `assets/form.js` is now wrapped in a top-level
  IIFE (`(() => { ... })();`), so none of its functions or constants leak
  onto `window`.

Both changes were verified against the current live quiz (headless
browser: visual screenshot diff, plus a scripted click-through of step 1 →
radio select → submit → step 2, confirming no console errors and no
functional regression).

## Suggested order of operations once WP access exists

1. Confirm the WP account has `unfiltered_html` (or that OP3's code block
   is exempt from `wp_kses_post`) by testing a throwaway `<form>`/`<script>`
   snippet — risk #1.
2. Confirm whether the custom JS/CSS fields shown are page-scoped or
   site-wide — determines whether the `.rsc-quiz` scoping done above is
   sufficient or whether OP3 offers (and requires) a different injection
   point.
3. Check OP3 docs/admin for any custom conversion-tracking JS API — risk
   #7, directly affects whether the "plugs into his stats" expectation is
   realistic.
4. Only after 1–3 are answered: decide on absolute asset hosting (risk #4)
   and rewire step-to-step navigation URLs (risk #5) for the real OP3 page
   slugs.
5. Explicitly confirm with the client whether the final rendered-video step
   should also carry real site chrome (risk #6), since the current
   `document.write` mechanism can't provide that without a redesign.
