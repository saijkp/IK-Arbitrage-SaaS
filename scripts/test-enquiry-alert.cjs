const assert = require('node:assert/strict');
const path = require('node:path');
const fn = require(path.join(__dirname, '../ik-v4/netlify/functions/submission-created.js'));

let calls = [];
global.fetch = async (url, options = {}) => { calls.push({ url: String(url), options }); return { ok: true, json: async () => ({ id: 'x' }) }; };
const run = async (form_name, data, id = 'abc123') => { calls = []; return JSON.parse((await fn.handler({ body: JSON.stringify({ payload: { form_name, id, data } }) })).body); };
const email = () => JSON.parse(calls.find(c => c.url.includes('resend')).options.body);

(async () => {
  const { whatsappNumber, draftReply } = fn._test;
  assert.equal(whatsappNumber('07767 990007'), '447767990007');
  assert.equal(whatsappNumber('+44 7767 990007'), '447767990007');
  assert.equal(whatsappNumber('0044 7767 990007'), '447767990007');
  assert.equal(whatsappNumber('12'), '');

  // Without keys nothing is sent and nothing throws.
  delete process.env.RESEND_API_KEY; delete process.env.CALLMEBOT_PHONE; delete process.env.CALLMEBOT_APIKEY;
  assert.deepEqual(await run('sourcing-brief', { name: 'Jo Bloggs', email: 'jo@example.com', location: 'Leeds' }), { email: 'not configured', whatsapp: 'not configured' });
  assert.equal(calls.length, 0);

  process.env.RESEND_API_KEY = 're_test';
  const sparse = await run('sourcing-brief', { name: 'Jo Bloggs', email: 'jo@example.com', location: 'Leeds', ptype: 'HMO', lead_source: 'google-ads | campaign 1 | gclid yes', design_support: 'Yes' });
  assert.equal(sparse.email, 'sent');
  const sent = email();
  assert.deepEqual(sent.to, ['sai@ikeng.co.uk']);
  assert.equal(sent.reply_to, 'jo@example.com');
  assert.match(sent.subject, /^New enquiry \(Google Ads\): Jo Bloggs - HMO - Leeds$/);
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'enquiry-abc123');
  assert.match(sent.text, /phone or WhatsApp number/);
  assert.match(sent.text, /in-house designer/);
  assert.match(sent.html, /mailto:jo%40example\.com/);
  assert.doesNotMatch(sent.html, /wa\.me/, 'no WhatsApp link without a phone');

  // Complete brief: no missing-detail questions, only the two further questions.
  const full = { name: 'Ann Lee', email: 'ann@example.com', phone: '07700 900123', location: 'M7 1AL', units: '6', cat: 'Furniture', dimensions: 'plans attached', references: 'link', finish_level: 'Mid-range', budget: '£20k', delivery_date: 'March' };
  const draft = draftReply('sourcing-brief', full);
  assert.match(draft, /gives us what we need/);
  assert.equal((draft.match(/^- /gm) || []).length, 2);
  await run('sourcing-brief', full);
  assert.match(email().html, /wa\.me\/447700900123\?text=/);

  // HTML in submissions is escaped.
  await run('sourcing-brief', { name: '<b>x</b>', email: 'x@example.com', notes: '<script>alert(1)</script>' });
  assert.doesNotMatch(email().html, /<script>|<b>x<\/b>/);

  // Package brief treats "To be confirmed" as missing.
  assert.match(draftReply('package-brief', { name: 'Sam', rooms: 'To be confirmed', phone: '07700900123', delivery_postcode: 'LS1', budget: '£5k', required_delivery: 'To be confirmed' }), /rooms and quantities[\s\S]*When you need delivery/);

  // WhatsApp ping only when configured, and without contact details or brief text.
  process.env.CALLMEBOT_PHONE = '+447767990007'; process.env.CALLMEBOT_APIKEY = '123';
  const pinged = await run('package-brief', { name: 'Sam Smith', email: 'sam@example.com', phone: '07700900123', property_type: 'Whole house', brief_summary: 'secret details' });
  assert.equal(pinged.whatsapp, 'sent');
  const ping = decodeURIComponent(calls.find(c => c.url.includes('callmebot')).url);
  assert.match(ping, /New IK ENG enquiry: Sam, Whole house/);
  assert.doesNotMatch(ping, /sam@example|07700900123|secret/);

  // Catalogue lead: email alert, no draft, no WhatsApp.
  const lead = await run('trade-catalogue', { name: 'Kim', email: 'kim@example.com' });
  assert.equal(lead.whatsapp, 'skipped');
  assert.match(email().subject, /^New lead: Kim$/);
  assert.doesNotMatch(email().html, /Reply draft/);

  // Unknown forms, spam and malformed events are ignored.
  assert.deepEqual(await run('other-form', { name: 'x' }), { skipped: true });
  assert.deepEqual(await run('sourcing-brief', { name: 'x', 'bot-field': 'spam' }), { skipped: true });
  assert.equal((await fn.handler({ body: 'not json' })).statusCode, 400);

  // A failed send is reported, not thrown.
  global.fetch = async () => ({ ok: false });
  assert.deepEqual(await run('sourcing-brief', { name: 'Jo', email: 'jo@example.com' }), { email: 'failed', whatsapp: 'failed' });
  console.log('PASS: owner email, reply-to, idempotency, missing-detail draft, WhatsApp/email/call links, escaping, CallMeBot privacy, catalogue leads, spam/unknown skip, failures.');
})().catch(err => { console.error(err); process.exit(1); });
