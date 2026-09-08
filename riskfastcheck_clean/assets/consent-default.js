// Google Consent Mode v2 default: deny tracking storage until the visitor
// consents, unless they already granted (or denied) consent on this site or
// on markusdan.com. Loaded synchronously (no defer/async) so it runs before
// the Google Tag Manager snippet.
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

(function () {
  function getSharedConsentCookie() {
    try {
      var match = document.cookie.match(/(?:^|; )md_consent=([^;]*)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (e) {
      return null;
    }
  }

  var rscStoredConsent = 'denied';
  var shared = getSharedConsentCookie();
  if (shared === 'granted' || shared === 'denied') {
    rscStoredConsent = shared;
  } else {
    try {
      if (localStorage.getItem('rsc-cookie-consent') === 'granted') {
        rscStoredConsent = 'granted';
      }
    } catch (e) {}
  }

  gtag('consent', 'default', {
    'ad_storage': rscStoredConsent,
    'ad_user_data': rscStoredConsent,
    'ad_personalization': rscStoredConsent,
    'analytics_storage': rscStoredConsent
  });
})();
