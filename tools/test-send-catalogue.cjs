// Run with node tools/test-send-catalogue.cjs. All email traffic is mocked.
const assert = require('node:assert/strict');
const { handler } = require('../ik-v4/netlify/functions/send-catalogue.js');
(async () => {
  let calls = []; process.env.RESEND_API_KEY = 'test-only';
  global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: 'test-id' }) }; };
  const event = body => ({ httpMethod: 'POST', body: JSON.stringify(body) });
  assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 405);
  assert.equal((await handler({ httpMethod: 'POST', body: '{bad' })).statusCode, 400);
  for (const body of [null, [], { name: 4, email: 'a@b.co' }, { name: 'Test', email: 'bad' }, { name: '', email: 'a@b.co' }]) assert.equal((await handler(event(body))).statusCode, 400);
  await handler(event({ 'bot-field': 'spam' })); assert.equal(calls.length, 0);
  const body = { name: '<b>Test</b>', email: 'test@example.com', requestId: '11111111-1111-4111-8111-111111111111' };
  assert.equal((await handler(event(body))).statusCode, 200);
  assert.equal(calls.length, 1);
  const payload = JSON.parse(calls[0].options.body);
  assert(payload.html.includes('&lt;b&gt;Test&lt;/b&gt;')); assert(!payload.html.includes('<b>Test</b>'));
  assert(payload.html.includes('Salford')); assert(payload.html.includes('/downloads/ik-eng-trade-catalogue-2026.pdf'));
  assert(!('scheduled_at' in payload)); assert.deepEqual(payload.to, ['test@example.com']);
  await handler(event(body)); assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key']);
  global.fetch = async () => ({ ok: false }); assert.equal((await handler(event(body))).statusCode, 502);
  global.fetch = async () => { throw new Error('network'); }; assert.equal((await handler(event(body))).statusCode, 502);
  delete process.env.RESEND_API_KEY; assert.equal((await handler(event(body))).statusCode, 503);
  console.log('PASS: validation, honeypot, escaped email content, one email per request, retry idempotency, configuration and delivery errors.');
})().catch(error => { console.error(error); process.exit(1); });
