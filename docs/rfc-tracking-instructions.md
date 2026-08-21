# Tracking Setup Brief (rsc.markusdan.com)

Date: 2026-08-19

Transcribed from `docs/rfc-tracking-instructions.pdf` (client-provided; kept
local-only, not committed, since it embeds a live Meta Conversions API
access token in plaintext). Secrets referenced below live in `.env`
(`PIXEL_ID`, `CONVERSIONS_API_TOKEN`) — never commit them.

## Goal

Full funnel + conversion tracking across the 6-page questionnaire, reporting
into Google Analytics 4 (GA4), Google Ads, and Meta Ads (Facebook/Instagram).

**Domain note:** main site is `markusdan.com`; the questionnaire lives on
the subdomain `rsc.markusdan.com`. Reuse the existing GTM container already
live on the main domain — add new triggers/tags scoped specifically to
`rsc.markusdan.com/schritt-*` pages so they don't fire on the rest of the
main site.

Implement via **Google Tag Manager (GTM)** as the single tracking layer
(not hardcoded tags), so tracking can be adjusted later without another dev
change.

## Pages in the funnel

1. `https://rsc.markusdan.com/schritt-1`
2. `https://rsc.markusdan.com/schritt-2`
3. `https://rsc.markusdan.com/schritt-3`
4. `https://rsc.markusdan.com/schritt-4`
5. `https://rsc.markusdan.com/schritt-5`
6. `https://rsc.markusdan.com/schritt-6` ← conversion page

## What to track

### A. Step views (funnel drop-off tracking in GA4)

Fire a custom event on each page load:

| Page | Event name |
|---|---|
| schritt-1 | `RFCstep_1_view` |
| schritt-2 | `RFCstep_2_view` |
| schritt-3 | `RFCstep_3_view` |
| schritt-4 | `RFCstep_4_view` |
| schritt-5 | `RFCstep_5_view` |
| schritt-6 | `RFCstep_6_view` |

### B. The conversion event

On schritt-6, fire a `generate_lead` (or `questionnaire_complete`) event on
**successful form submission**, not just on page load — unless there is no
separate submit action on that page, in which case page view on schritt-6
is fine. *Needs confirming which applies on our schritt-6* (note:
schritt-6/schritt-7 currently swap in the rendered-video page via
`document.write`, not a traditional form submit to that URL — worth
checking exactly where the "conversion" moment actually is against this
architecture).

This one event should push to all three destinations:

- GA4 (as a conversion-marked event)
- Google Ads (as a conversion action)
- Meta Pixel + Meta Conversions API (server-side, deduplicated with the
  browser pixel)

## Accounts & IDs

**Google Tag Manager**
- Container ID: `GTM-NJPGLLZW` (existing container, already live on
  markusdan.com)

**GA4**
- Measurement ID: `G-BM66MKWBDH` (existing data stream for markusdan.com)

**Meta**
- Pixel ID: see `.env` → `PIXEL_ID`
- Conversions API Access Token: see `.env` → `CONVERSIONS_API_TOKEN`
  (redacted here — full value only in `.env`, which is gitignored)

## Requirements

- **Cross-subdomain tracking** — since `rsc.markusdan.com` is a subdomain
  of `markusdan.com` and shares the same GTM container and GA4 property,
  the GA4 client ID cookie needs to be scoped at the root domain level
  (`.markusdan.com`) so a visitor moving between the main site and the
  questionnaire is tracked as the same user/session, not counted twice.
- **Enhanced Conversions (Google Ads)** — if the questionnaire captures
  email or phone number, implement Enhanced Conversions (hashed, sent with
  the conversion) to improve match quality.
- **Meta Conversions API (CAPI)** — implement alongside the browser Pixel,
  not Pixel alone, since browser-only tracking loses a meaningful share of
  events (ad blockers, iOS, Safari ITP). Meta should deduplicate CAPI +
  Pixel events automatically via a shared event ID.
- **Consent Mode v2 (Google) + consent handling (Meta)** — EU/German
  traffic, so tracking must respect the cookie consent banner. GTM
  triggers should fire only after appropriate consent; needs confirming
  whether the current cookie banner already supports Consent Mode v2 or
  needs updating.
- **Testing** — before going live, verify all 6 step events and the final
  conversion event in:
  - GTM Preview mode
  - GA4 DebugView / Realtime report
  - Google Ads "Tag diagnostics"
  - Meta Events Manager "Test Events" tool
