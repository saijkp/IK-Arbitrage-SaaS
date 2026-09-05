(function () {
  var GTM_ID = 'GTM-WCBF9CN4';
  var STORAGE_KEY = 'ik_cookie_consent';

  function loadGTM() {
    if (window._ikGtmLoaded) return;
    window._ikGtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : '';
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GTM_ID);
  }

  function hideBanner() {
    var el = document.getElementById('ik-cookie-banner');
    if (el) el.remove();
  }

  function setConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
    hideBanner();
    if (value === 'accepted') loadGTM();
  }

  function showBanner() {
    var el = document.createElement('div');
    el.id = 'ik-cookie-banner';
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1a1a18;color:#fff;' +
      'padding:16px 20px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;' +
      'font-family:Outfit,Arial,sans-serif;font-size:.85rem;box-shadow:0 -4px 20px rgba(0,0,0,.25);' +
      'border-top:1px solid rgba(255,255,255,.08);';
    el.innerHTML =
      '<div style="flex:1 1 320px;max-width:640px;line-height:1.5;">' +
        'We use cookies for site analytics (Google Analytics) to understand what\'s useful and improve the site. ' +
        '<a href="/privacy" style="color:#c8922a;text-decoration:underline;">Privacy Policy</a>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-shrink:0;">' +
        '<button id="ik-cookie-decline" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3);' +
          'padding:9px 18px;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;">Decline</button>' +
        '<button id="ik-cookie-accept" style="background:#c8922a;color:#1a1a18;border:none;padding:9px 18px;' +
          'border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;">Accept</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('ik-cookie-accept').addEventListener('click', function () { setConsent('accepted'); });
    document.getElementById('ik-cookie-decline').addEventListener('click', function () { setConsent('declined'); });
  }

  var stored;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { stored = null; }

  if (stored === 'accepted') {
    loadGTM();
  } else if (stored !== 'declined') {
    if (document.body) showBanner();
    else document.addEventListener('DOMContentLoaded', showBanner);
  }
})();
