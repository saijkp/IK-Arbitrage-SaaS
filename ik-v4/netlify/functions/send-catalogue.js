// One requested email only. No nurture enrolment or scheduled follow-ups.
const { createHash } = require('node:crypto');
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return { ...reply(405, { error: 'POST required.' }), headers: { ...headers, Allow: 'POST' } };
  if ((event.body || '').length > 10000) return reply(413, { error: 'Request too large.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid request.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid request.' });
  if (body['bot-field']) return reply(200, { sent: true });
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!name || name.length > 200 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(name)) {
    return reply(400, { error: 'Valid name and email required.' });
  }
  if (!process.env.RESEND_API_KEY) return reply(503, { error: 'Catalogue email is temporarily unavailable.' });
  const from = process.env.RESEND_FROM_EMAIL || 'IK ENG <onboarding@resend.dev>';
  const catalogue = 'https://ikeng.co.uk/downloads/ik-eng-trade-catalogue-2026.pdf';
  const brief = 'https://ikeng.co.uk/#brief';
  const safeName = escapeHtml(name);
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#16140f;line-height:1.6">
    <div style="background:#1a1a18;color:#c8922a;padding:28px;font-size:22px">IK ENG</div>
    <div style="padding:28px"><h1 style="font-family:Georgia,serif;font-size:27px">Your trade catalogue</h1>
    <p>Hi ${safeName},</p><p>Explore kitchens, wardrobes and furniture for your next home or property project.</p>
    <p>Example products from our partner factories. Made to your specification.</p>
    <p><a href="${catalogue}" style="display:inline-block;background:#1d6b5e;color:white;padding:13px 20px;text-decoration:none">Download the trade catalogue</a></p>
    <p>Keep the IKE references you like. Send your plans, quantities, budget and timing so we can confirm suitable options.</p>
    <p><a href="${brief}" style="display:inline-block;background:#c8922a;color:#16140f;padding:13px 20px;text-decoration:none">Send your project brief</a></p>
    <p style="font-size:12px;margin-top:32px">IK Eng Ltd<br>125 Great Clowes Street, Salford, Greater Manchester, M7 1AL<br>+44 7767 990007 | <a href="mailto:sai@ikeng.co.uk">sai@ikeng.co.uk</a></p>
    <p style="font-size:12px">You requested this catalogue. This request does not enrol you in a follow-up sequence.</p></div></div>`;
  const text = `Hi ${name},\n\nYour IK ENG trade catalogue: ${catalogue}\n\nSend your project brief: ${brief}\n\nExample products from our partner factories. Made to your specification.\n\nIK Eng Ltd, 125 Great Clowes Street, Salford, Greater Manchester, M7 1AL\n+44 7767 990007 | sai@ikeng.co.uk`;
  // Stable for retries of the same form request; no personal data in the key.
  const requestId = typeof body.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : new Date().toISOString().slice(0, 10);
  const idempotency = createHash('sha256').update(`${email}|${requestId}`).digest('hex');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `catalogue-${idempotency}` },
      body: JSON.stringify({ from, to: [email], subject: 'Your IK ENG trade catalogue', html, text }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return reply(502, { error: 'Email send failed. Please try again.' });
    const result = await response.json();
    if (!result.id) return reply(502, { error: 'Email delivery was not confirmed.' });
    return reply(200, { sent: true });
  } catch { return reply(502, { error: 'Email send failed. Please try again.' }); }
};
