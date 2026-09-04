# markusdan repo architecture

This repo contains **three independently-deployed systems** that share a git
history but do not share a deploy mechanism. Before touching a file, check
which system it belongs to below — editing a file here does not mean it's
live anywhere until the matching deploy step happens.

## 1. Quiz — `riskfastcheck_clean/` (static, Cloudflare Pages)

Static HTML/CSS/JS funnel: `schritt-1.html` through `schritt-6.html`
("Schritt" = German for "Step"). Step 1 shows a Vimeo-embedded video above
two required radio questions; `assets/form.js` handles validation, state,
and step-to-step navigation (`renderStepVideo()`, `mountVimeoPlayer`-style
logic).

- **Hosting**: Cloudflare Pages, on the site owner's own Cloudflare account
  (free tier — static bandwidth/requests are unmetered, no billing risk
  from traffic volume).
- **Deploy scope**: the Pages project's *root directory* is set to
  `riskfastcheck_clean/`. A push only triggers a redeploy if the diff
  touches files under that folder — commits that only touch root-level
  files (render-service, n8n mirrors, docs) do **not** redeploy this site.
- **Push = deploy**: pushing to `master` deploys automatically once a
  matching-path commit lands. Never push without explicit confirmation.

## 2. Render service — `render-service/` (Docker, client's DigitalOcean VPS)

Node/FFmpeg HTTP service that renders the personalized video sequence
(`POST /render/jobs`, polled via `GET /render/jobs/:jobId`). See
`render-service/README.md` for the API and production deploy steps in
full — short version: **this git checkout is not the deploy target.**
Changes must be manually copied into `/opt/megyk/n8n-docker-caddy` on the
server and rebuilt with `docker compose` from there. A commit/push to this
repo does not touch the running service.

- **Ownership**: client's own DigitalOcean VPS — not billed to us, and not
  a Cloudflare concern at all.

## 3. n8n workflow — `Webhook Wrapper (Crossfade).json` (client's n8n instance)

**This is the live production workflow as of the 2026-08-31 cutover**
(commit `1bf3fc8`) — `assets/form.js`'s submit handler points at it, not
the older `Webhook Wrapper.json`. It streams the original Vimeo clips
directly and crossfades them client-side (two stacked `<video>` elements),
replacing the earlier server-side render pipeline entirely. It's an **n8n
workflow export**, not application source — the orchestration layer that
resolves the quiz answers and serves the personalized answer page.
Several of its nodes embed inline JavaScript ("Code" nodes) whose logic is
*mirrored* at the repo root as standalone `rsc-*-node.js` files purely so
they're readable/editable/diffable outside n8n's UI:

| Root-level mirror file                       | n8n node name           |
|-----------------------------------------------|--------------------------|
| `rsc-generate-answer-page-crossfade-node.js`   | `Generate Answer Page`  |
| `rsc-fetch-play-urls-node.js`                  | (fetch-play-urls node)  |
| `rsc-resolve-pitch-node.js`                    | (resolve-pitch node)    |
| `rsc-parse-answers-node.js`                    | (parse-answers node)    |

**`Webhook Wrapper.json` (no "Crossfade" suffix) is legacy/abandoned** —
an earlier attempt at a more elaborate Lambda-based server-side render
pipeline, with the pitch clip split out to play from Vimeo directly. It
underperformed vs. the crossfade approach and was dropped in favor of it;
its mirror is `rsc-generate-answer-page-node.js`. It's kept in the repo
for history only — don't sync changes into it, and don't treat drift
between it and its own n8n export as something to fix.

**Critical**: editing a `rsc-*-node.js` mirror file in this repo does
**nothing** in production by itself. The sync is manual and
one-directional, driven by the repo owner, not by Claude:

1. Claude edits the standalone `rsc-*-node.js` file in this repo.
2. The owner manually copy-pastes that code into the matching Code node
   inside n8n's UI.
3. The owner re-exports/re-downloads the workflow from n8n, which
   overwrites the matching `Webhook Wrapper*.json` in this repo.

So **never edit `Webhook Wrapper (Crossfade).json` (or `Webhook
Wrapper.json`) directly** — it gets clobbered by step 3 anyway, and doing
so would fight the owner's workflow. Land changes only in the
`rsc-*-node.js` mirror and say so; the owner handles the n8n side. Check
whether a given change has already been synced (i.e. whether the export
has been re-downloaded since) with a quick script, e.g.:

```bash
python3 -c "
import json
with open('Webhook Wrapper (Crossfade).json') as f:
    data = json.load(f)
for node in data['nodes']:
    if node['name'] == 'Generate Answer Page':
        code = node['parameters'].get('jsCode', '')
        print('requestFullscreen' in code)  # swap in whatever landmark you just added
"
```

This answer page renders inside a `.frame` container (`id="frame"`) that
holds the video/player, poster, mute toggle, and (since DEH-32) the CTA
button overlay all as siblings in one stacking context — relevant any time
a ticket wants fullscreen, layout, or CTA-visibility changes, since
fullscreening `.frame` (not just the video) is what keeps the CTA visible.

- **Ownership**: client's own n8n instance (`n8n.megyk.com`) — not billed
  to us.

## Jira ticket → system map (DEH project, `gordank.atlassian.net`)

Keep this updated as new tickets land — the summary text alone is often
ambiguous about which of the three systems above it actually touches;
confirm by checking related tickets' file diffs, not just the wording.

| Ticket | System | Files |
|--------|--------|-------|
| DEH-31, DEH-32, DEH-33, DEH-38, DEH-39 | n8n mirror (answer page) | `rsc-generate-answer-page-node.js` + `Webhook Wrapper.json` → `Generate Answer Page` node |
| DEH-34 | Quiz | `riskfastcheck_clean/schritt-1.html`, `assets/form.js` |

## Solo-repo git workflow

Single committer (`adamhaley`) — commit freely, but **never push without
explicit confirmation**, since a push can trigger a live Cloudflare Pages
deploy depending on which paths changed (see §1).
