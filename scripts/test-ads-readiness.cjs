const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '../ik-v4');
const source = fs.readFileSync(path.join(root, 'lead-source.js'), 'utf8');
const campaign = '?utm_source=google&utm_medium=cpc&utm_campaign=123&utm_content=456&gclid=TEST';
const expected = 'google-ads | campaign 123 | adgroup 456 | gclid yes';
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
  for (const name of ['sourcing-brief', 'package-brief', 'trade-catalogue', 'guide-download']) assert.equal(p.submit(name), expected);
  assert(!p.submit().includes('TEST'));
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
assert.equal(page('?gbraid=abc&wbraid=xyz', false).submit(), 'google-ads | gbraid yes | wbraid yes');
for (const query of ['?gclid=<script>', '?gclid=' + 'a'.repeat(201), '?utm_source=' + 'a'.repeat(101), '?utm_source=%3Cb%3E', '?utm_campaign=a%0Ab', '?utm_source=a%0A', '?gclid=a%0D', '?unknown=anything']) assert.equal(page(query, true).submit(), 'direct/organic');
assert.equal(page('?gclid=' + 'a'.repeat(200), false).submit(), 'google-ads | gclid yes');
assert.equal(page('?utm_source=a%2Bb._-+c', false).submit(), 'utm: a+b._- c');
const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const broken = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const before = execFileSync('git', ['show', 'origin/main:ik-v4/' + file], { cwd: path.join(root, '..'), encoding: 'utf8' });
  for (const pattern of [/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, /<link\b[^>]*rel="canonical"[^>]*>/gi]) assert.deepEqual(html.match(pattern), before.match(pattern), file + ': heading/canonical unchanged');
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
  for (const match of html.matchAll(/<form\b[^>]*name="(sourcing-brief|package-brief|trade-catalogue|guide-download)"[^>]*>([\s\S]*?)<\/form>/g)) assert.equal((match[2].match(/name="lead_source"/g) || []).length, 1, file);
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
(async () => { await catalogue(true); await catalogue(false); console.log('PASS: consent, first-touch attribution, validation, blocked storage, all form fields, catalogue retries, click events, local links/anchors and unchanged H1/canonicals on ' + htmlFiles.length + ' pages.'); })().catch(error => { console.error(error); process.exitCode = 1; });
