// Google Tag Gateway manual setup (GTM-container mode).
// Proxies everything under /metrics/* to Google's first-party tagging
// endpoint (fps.goog) so gtm.js and its collect/measurement calls look
// first-party to the browser, dodging ad-blocker/ITP request blocking.
// See: https://developers.google.com/tag-platform/tag-manager/gateway/setup-guide?setup=manual
//
// Advanced-mode Pages Function: this file replaces Cloudflare Pages'
// default static-asset handling entirely, so every non-/metrics/ request
// must be explicitly forwarded to env.ASSETS.fetch(request) below.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
