const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '../ik-v4');
const source = fs.readFileSync(path.join(root, 'lead-source.js'), 'utf8');
const campaign = '?utm_source=google&utm_medium=cpc&utm_campaign=123&utm_content=456&gclid=TEST';
const expected = 'google-ads | campaign 123 | adgroup 456 | gclid TEST';
function page(search, consent, saved, blocked = false) {
  const listeners = {}, field = { value: '' }, storage = new Map(saved ? [['ik_lead_source', saved]] : []);
  let reads = 0, writes = 0;
  const context = { URLSearchParams, location: { search }, window: { _ikGtmLoaded: consent, addEventListener() {} },
    document: { addEventListener: (name, fn, capture) => { listeners[name] = fn; if (name === 'submit') assert.equal(capture, true); } },
    sessionStorage: { getItem(key) { reads++; if (blocked) throw Error(); return storage.get(key) || null; }, setItem(key, value) { writes++; if (blocked) throw Error(); storage.set(key, value); } } };
  vm.runInNewContext(source, context);
  return { context, storage, counts: () => [reads, writes], click: () => listeners.click(), submit(name = 'sourcing-brief') {
    // Real forms here contain an input called "name", which shadows form.name.
    listeners.submit({ target: { name: { tagName: 'INPUT' }, getAttribute: attr => attr === 'name' ? name : null, elements: { namedItem: () => field } } }); return field.value;
  } };
}
for (const consent of [true, false]) {
  const p = page(campaign, consent);
  for (const name of ['sourcing-brief', 'package-brief', 'trade-catalogue', 'guide-download', 'shipping-quote']) assert.equal(p.submit(name), expected);
  assert(p.submit().includes('TEST'));
  if (!consent) assert.deepEqual(p.counts(), [0, 0]);
  assert.equal(page('', consent).submit(), 'direct/organic');
}
const accepted = page(campaign, false); accepted.context.window._ikGtmLoaded = true; accepted.click();
const saved = accepted.storage.get('ik_lead_source');
assert.equal(page('?utm_campaign=later', true, saved).submit(), expected);
assert.equal(page('', true, saved).submit(), expected);
assert.equal(page('', false, saved).submit(), 'direct/organic');
assert.equal(page(campaign, true, null, true).submit(), expected);
assert.equal(page(campaign, true, '{invalid').submit(), expected);
assert.equal(page('?utm_source=newsletter&utm_medium=email&utm_campaign=spring', false).submit(), 'utm: newsletter / email / spring');
assert.equal(page('?gbraid=abc&wbraid=xyz', false).submit(), 'google-ads | gbraid abc | wbraid xyz');
assert.equal(page('?gbraid=TEST', false).submit(), 'google-ads | gbraid TEST');
for (const query of ['?gclid=<script>', '?gclid=' + 'a'.repeat(201), '?utm_source=' + 'a'.repeat(101), '?utm_source=%3Cb%3E', '?utm_campaign=a%0Ab', '?utm_source=a%0A', '?gclid=a%0D', '?unknown=anything']) assert.equal(page(query, true).submit(), 'direct/organic');
assert.equal(page('?gclid=' + 'a'.repeat(200), false).submit(), 'google-ads | gclid ' + 'a'.repeat(200));
assert.equal(page('?utm_source=a%2Bb._-+c', false).submit(), 'utm: a+b._- c');
const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const broken = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert(!html.includes('\0'), file + ': no NULL bytes');
  for (const block of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(block[1]);
  const trackedOnMain = execFileSync('git', ['ls-tree', '--name-only', 'origin/main', '--', 'ik-v4/' + file], { cwd: path.join(root, '..'), encoding: 'utf8' }).trim();
  const before = trackedOnMain ? execFileSync('git', ['show', 'origin/main:ik-v4/' + file], { cwd: path.join(root, '..'), encoding: 'utf8' }) : null;
  if (!before) {
    assert.equal((html.match(/<h1\b[^>]*>/gi) || []).length, 1, file + ': one H1 on new page');
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, file + ': one canonical on new page');
    assert(html.includes('https://ikeng.co.uk/' + file), file + ': canonical URL for new page');
  }
  if (before) for (const pattern of [/<title>[\s\S]*?<\/title>/gi, /<h1\b[^>]*>[\s\S]*?<\/h1>/gi, /<link\b[^>]*rel="canonical"[^>]*>/gi]) assert.deepEqual(html.match(pattern), before.match(pattern), file + ': title/heading/canonical unchanged');
  assert.equal((html.match(/src="\/lead-source.js"/g) || []).length, 1);
  const clickScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('whatsapp_click'));
  assert(clickScript, file);
  assert.equal((html.match(/event: 'whatsapp_click'/g) || []).length, 1);
  for (const consent of [true, false]) {
    let click; const events = []; const context = { window: { _ikGtmLoaded: consent, dataLayer: events }, dataLayer: events, location: { href: 'https://example.test/' }, document: { addEventListener: (_, fn) => { click = fn; } } };
    vm.runInNewContext(clickScript, context);
    for (const href of ['https://wa.me/447767990007', 'https://example.test/#brief', 'tel:+447767990007']) click({ target: { closest: () => ({ href }) } });
    assert.deepEqual(events.map(e => e.event), consent ? ['whatsapp_click', 'brief_cta_click', 'phone_click'] : []);
  }
  for (const match of html.matchAll(/<form\b[^>]*name="(sourcing-brief|package-brief|trade-catalogue|guide-download|shipping-quote)"[^>]*>([\s\S]*?)<\/form>/g)) assert.equal((match[2].match(/name="lead_source"/g) || []).length, 1, file);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = new URL(match[1].replace(/&amp;/g, '&'), 'https://ikeng.co.uk/' + file);
    if (url.origin !== 'https://ikeng.co.uk') continue;
    let target = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
    if (!path.extname(target)) target += '.html';
    if (!fs.existsSync(path.join(root, target))) { broken.push(file + ': ' + match[1]); continue; }
    if (url.hash && target.endsWith('.html') && !fs.readFileSync(path.join(root, target), 'utf8').includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"')) broken.push(file + ': ' + match[1]);
  }
}
assert.deepEqual(broken, []);
async function catalogue(consent) {
  let submit, captureOk = false, deliveryOk = false; const requests = [], events = [];
  const fields = { name: { value: 'Test' }, email: { value: 'test@example.com' }, 'bot-field': { value: '' }, lead_source: { value: expected } };
  const status = { dataset: {} }, button = {};
  const form = { elements: fields, querySelector: selector => selector === '.catalogue-status' ? status : button, reportValidity: () => true, addEventListener: (_, fn) => { submit = fn; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'catalogue-form.js'), 'utf8'), {
    document: { querySelectorAll: () => [form] }, window: { _ikGtmLoaded: consent, dataLayer: events }, URLSearchParams, AbortSignal,
    crypto: { randomUUID: () => 'test-request' }, FormData: class extends Map { constructor() { super(Object.entries(fields).map(([k, v]) => [k, v.value])); } },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: url === '/' ? captureOk : deliveryOk, json: async () => ({ sent: deliveryOk }) }; }
  });
  const send = () => submit({ preventDefault() {} });
  await send(); assert.equal(events.length, 0);
  captureOk = true; await send(); assert.equal(events.length, consent ? 1 : 0);
  fields.lead_source.value = 'direct/organic'; deliveryOk = true; await send(); await send();
  assert.equal(requests.filter(r => r.url === '/').length, 2, 'Only failed capture is retried');
  assert.equal(events.length, consent ? 1 : 0, 'Email retry and duplicate cannot count again');
  if (consent) assert.equal(events[0].form_name, 'trade_catalogue');
  assert.equal(new URLSearchParams(requests[1].options.body).get('lead_source'), expected);
}
async function briefCapture(name, consent) {
  let submit, valid = false, captureOk = false, role = false;
  const events = [], requests = [], shown = [], button = {}, error = { style: {}, setAttribute() {} };
  const shipping = name === 'shipping-quote';
  const fields = { 'form-name': name, name: 'Test', email: 'test@example.com', lead_source: expected, 'bot-field': '' };
  const form = { getAttribute: () => name, append() {}, reportValidity: () => valid,
    querySelector: selector => selector === 'input[name=role]:checked' ? role : button,
    addEventListener: (_, fn) => { submit = fn; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'brief-form.js'), 'utf8'), {
    document: { querySelectorAll: () => [], createElement: () => error, getElementById: id => {
      if (id === (shipping ? 'shippingQuoteForm' : 'briefForm')) return form;
      if (id === (shipping ? 'shippingSuccess' : 'briefSuccess')) return { classList: { add: value => shown.push(value) } };
      return null;
    } }, location: { search: '' }, window: { _ikGtmLoaded: consent, dataLayer: events }, URLSearchParams, AbortSignal,
    FormData: class extends Map { constructor() { super(Object.entries(fields)); } },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: captureOk }; }
  });
  const send = () => submit({ preventDefault() {} });
  await send(); assert.equal(requests.length, 0, 'Invalid form cannot submit');
  valid = true;
  if (!shipping) { await send(); assert.equal(requests.length, 0, 'Sourcing still requires role'); role = true; }
  await send(); assert.equal(events.length, 0, 'Failed capture cannot count');
  assert.equal(error.hidden, false); assert.equal(button.disabled, false);
  captureOk = true; await send(); await send();
  assert.equal(requests.length, 2, 'Failure can retry; successful capture cannot duplicate');
  assert.deepEqual(shown, ['show']);
  assert.equal(events.length, consent ? 1 : 0);
  if (consent) { assert.equal(events[0].event, 'generate_lead'); assert.equal(events[0].form_name, shipping ? 'shipping_quote' : 'sourcing_brief'); }
  const payload = new URLSearchParams(requests[1].options.body);
  assert.equal(payload.get('form-name'), name); assert.equal(payload.get('lead_source'), expected);
}
const shippingHtml = fs.readFileSync(path.join(root, 'shipping-from-china-to-uk.html'), 'utf8');
for (const field of ['name', 'email', 'phone', 'supplier_name', 'supplier_city', 'goods_description', 'cartons_weight_volume', 'ready_date', 'uk_postcode', 'ddp_quote', 'cargo_insurance', 'pre_shipment_inspection', 'notes', 'lead_source', 'bot-field']) assert(shippingHtml.includes('name="' + field + '"'), 'Shipping field: ' + field);
assert(/<form\b[^>]*name="shipping-quote"[^>]*data-netlify="true"[^>]*data-netlify-honeypot="bot-field"/.test(shippingHtml));
const shippingFaq = [...shippingHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1])).find(s => s['@type'] === 'FAQPage');
const visibleFaq = shippingHtml.match(/<section aria-labelledby="faq">([\s\S]*?)<\/section>/)[1];
const plain = text => text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
assert.deepEqual([...visibleFaq.matchAll(/<h3>(.*?)<\/h3><p>([\s\S]*?)<\/p>/g)].map(m => [plain(m[1]), plain(m[2])]), shippingFaq.mainEntity.map(q => [q.name, q.acceptedAnswer.text]), 'Visible shipping FAQ exactly matches schema');
(async () => {
  await catalogue(true); await catalogue(false);
  for (const name of ['sourcing-brief', 'shipping-quote']) for (const consent of [true, false]) await briefCapture(name, consent);
  console.log('PASS: consent, attribution, form validation/retries/duplicate guards, shipping and sourcing generate_lead, catalogue retries, shipping FAQ/schema, JSON-LD, local links and unchanged titles/H1/canonicals on ' + htmlFiles.length + ' pages.');
})().catch(error => { console.error(error); process.exitCode = 1; });
