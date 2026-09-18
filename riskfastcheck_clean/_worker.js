// Google Tag Gateway manual setup (GTM-container mode).
// Proxies everything under /metrics/* to Google's first-party tagging
// endpoint (fps.goog) so gtm.js and its collect/measurement calls look
// first-party to the browser, dodging ad-blocker/ITP request blocking.
// See: https://developers.google.com/tag-platform/tag-manager/gateway/setup-guide?setup=manual
//
// Advanced-mode Pages Function: this file replaces Cloudflare Pages'
// default static-asset handling entirely, so every non-/metrics/ request
// must be explicitly forwarded to env.ASSETS.fetch(request) below.
//
// Server-side step-view logging: a redundancy measure requested by the
// client (2026-09-14) so funnel tracking doesn't have a single point of
// failure in Google's client-side tag stack (ad blockers, JS disabled,
// consent denial, or a GTM/GA4 outage all miss nothing here, since this
// fires before the page is even served). Best-effort only -- logging
// failures must never affect the page response, hence ctx.waitUntil +
// the try/catch in logStepView.
const STEP_LOG_WEBHOOK_URL = 'https://n8n.megyk.com/webhook/adb27565-9057-43a3-b9a9-f74a26a00427';
const STEP_LOG_PATHS = new Set([
  '/schritt-1',
  '/schritt-1b',
  '/schritt-1c',
  '/schritt-2',
  '/schritt-3',
  '/schritt-4',
  '/schritt-5',
  '/schritt-6',
  // Variant B (branching flow A/B test, see llm-wiki plan 2026-09-17) --
  // lives at /schnellcheck/ rather than /variante-b/ per client request
  // (2026-09-17, WhatsApp: "The wording of variant-b makes it obvious...").
  // Same webhook, a `variant` field distinguishes the rows.
  '/schnellcheck/schritt-1',
  '/schnellcheck/schritt-1b',
  '/schnellcheck/schritt-2',
  '/schnellcheck/schritt-2a',
  '/schnellcheck/schritt-3',
  '/schnellcheck/schritt-3a',
  '/schnellcheck/schritt-4',
  '/schnellcheck/schritt-4a',
  '/schnellcheck/schritt-5',
  '/schnellcheck/schritt-5a',
  '/schnellcheck/schritt-6',
  '/schnellcheck/schritt-6a',
  '/schnellcheck/schritt-7',
  '/schnellcheck/schritt-7a',
]);

async function logStepView(pathname) {
  try {
    const isVariantB = pathname.startsWith('/schnellcheck/');
    const step = isVariantB
      ? pathname.replace('/schnellcheck/schritt-', '')
      : pathname.replace('/schritt-', '');

    await fetch(STEP_LOG_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step,
        variant: isVariantB ? 'B' : 'A',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Best-effort only; never let a webhook failure affect the page response.
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && STEP_LOG_PATHS.has(url.pathname)) {
      ctx.waitUntil(logStepView(url.pathname));
    }

    if (url.pathname.startsWith('/metrics/')) {
      const newRequest = new Request(request);
      url.hostname = 'fps.goog';
      newRequest.headers.set('X-Gtg-Implementation', 'Snippet');
      newRequest.headers.set('X-Gtg-Tag-Id', 'GTM-NJPGLLZW');
      const forwardedFor = request.headers.get('CF-Connecting-IP');
      if (forwardedFor) {
        newRequest.headers.append('X-Forwarded-For', forwardedFor);
      }
      if (request.cf) {
        if (request.cf.country) {
          newRequest.headers.set('X-Forwarded-Country', request.cf.country);
        }
        if (request.cf.regionCode) {
          newRequest.headers.set('X-Forwarded-Region', request.cf.regionCode);
        }
        if (request.cf.latitude && request.cf.longitude) {
          newRequest.headers.set(
            'X-Forwarded-Geolocation',
            `latlong=${request.cf.latitude},${request.cf.longitude};city=${request.cf.city || ''}`,
          );
        }
      }
      return fetch(url, newRequest);
    }

    // Everything else: serve the site's normal static assets unchanged.
    return env.ASSETS.fetch(request);
  },
};
