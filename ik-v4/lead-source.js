// First valid campaign in this tab; storage is used only after analytics consent.
(() => {
  const key = 'ik_lead_source';
  const ids = ['gclid', 'gbraid', 'wbraid'];
  const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  function valid(input) {
    const result = {};
    if (!input || typeof input !== 'object') return result;
    ids.concat(utms).forEach(name => {
      const value = input[name];
      const pattern = ids.includes(name) ? /^[A-Za-z0-9._~{}|:-]{1,200}$/ : /^[A-Za-z0-9 ._+\-]{1,100}$/;
      if (typeof value === 'string' && !/[\r\n]/.test(value) && pattern.test(value)) result[name] = value;
    });
    return result;
  }
  const params = new URLSearchParams(location.search);
  const current = valid(Object.fromEntries(ids.concat(utms).map(name => [name, params.get(name)])));
  function source() {
    if (!window._ikGtmLoaded) return current;
    try {
      const saved = valid(JSON.parse(sessionStorage.getItem(key)));
      if (Object.keys(saved).length) return saved;
    } catch (_) {}
    if (Object.keys(current).length) {
      try { sessionStorage.setItem(key, JSON.stringify(current)); } catch (_) {}
    }
    return current;
  }
  function summary(data) {
    if (ids.some(name => data[name])) {
      return ['google-ads', data.utm_campaign && 'campaign ' + data.utm_campaign,
        data.utm_content && 'adgroup ' + data.utm_content,
        ...ids.filter(name => data[name]).map(name => name + ' yes')].filter(Boolean).join(' | ');
    }
    const values = utms.map(name => data[name]).filter(Boolean);
    return values.length ? 'utm: ' + values.join(' / ') : 'direct/organic';
  }
  source();
  // Capture phase runs before each form's own submission handler builds its payload.
  document.addEventListener('submit', event => {
    const form = event.target;
    // form.name would return the form's "name" input, so read the attribute.
    if (!['sourcing-brief', 'package-brief', 'trade-catalogue', 'guide-download'].includes(form.getAttribute('name'))) return;
    const field = form.elements.namedItem('lead_source');
    if (field) field.value = summary(source());
  }, true);
  // Consent can be accepted after page load. The button handler runs before bubbling here.
  document.addEventListener('click', source);
  window.addEventListener('pagehide', source);
})();
