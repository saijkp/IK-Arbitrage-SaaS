// Netlify runs this automatically for every verified form submission.
// Owner alert only: the customer is never emailed from here. The reply draft
// goes to the owner as one-tap email / WhatsApp links to review and send.
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clean = value => (typeof value === 'string' ? value.trim() : Array.isArray(value) ? value.join(', ').trim() : '').slice(0, 4000);
const missing = value => !value || /^(to be confirmed|not specified|none|n\/a|-)$/i.test(value);

const FORMS = {
  'sourcing-brief': { label: 'Sourcing brief', enquiry: true, type: 'ptype', place: 'location' },
  'package-brief': { label: 'Package builder brief', enquiry: true, type: 'property_type', place: 'delivery_postcode' },
  'trade-catalogue': { label: 'Trade catalogue request', enquiry: false },
  'guide-download': { label: 'Import guide download', enquiry: false }
};
const FIELD_ORDER = ['name', 'email', 'phone', 'company', 'role', 'ptype', 'property_type', 'project_name', 'location', 'delivery_postcode',
  'units', 'number_of_properties', 'rooms', 'cat', 'products', 'selected_items', 'description', 'dimensions', 'materials', 'finish_level',
  'specifications', 'storage_notes', 'references', 'budget', 'delivery_date', 'required_delivery', 'design_support', 'notes', 'brief_summary', 'lead_source'];
const SKIP = new Set(['bot-field', 'form-name', 'ip', 'user_agent', 'referrer']);

// Questions for details a brief left blank, most useful first.
const QUESTIONS = {
  'sourcing-brief': [
    ['phone', 'The best phone or WhatsApp number to reach you'],
    ['units', 'How many rooms, units or properties this covers'],
    ['cat', 'Which products you need (for example furniture, kitchens, wardrobes, bathrooms or lighting)'],
    ['dimensions', 'Floor plans or room dimensions'],
    ['references', 'Reference photos or links showing the style you like'],
    ['finish_level', 'The finish level you are aiming for (budget, mid-range or premium)'],
    ['budget', 'Your approximate budget'],
    ['delivery_date', 'When you need delivery on site']
  ],
  'package-brief': [
    ['phone', 'The best phone or WhatsApp number to reach you'],
    ['rooms', 'The rooms and quantities per property'],
    ['delivery_postcode', 'The delivery postcode'],
    ['budget', 'Your approximate budget'],
    ['required_delivery', 'When you need delivery on site']
  ]
};
const FURTHER = ['Site access for delivery (parking, stairs or lift)', 'Whether you need assembly or installation on site'];

function draftReply(form, data) {
  const first = (data.name || '').split(/\s+/)[0] || 'there';
  const spec = FORMS[form];
  // Lower-case ordinary words ("Whole house") but keep acronyms ("HMO", "BTR / PRS").
  const kind = (data[spec.type] || '').replace(/\b[A-Z][a-z]+\b/g, word => word.toLowerCase());
  const what = kind ? ` for your ${kind} project` : '';
  const asks = QUESTIONS[form].filter(([key]) => missing(data[key])).map(([, q]) => q).slice(0, 5);
  const list = asks.concat(FURTHER).slice(0, 6);
  const lines = [`Hi ${first},`, '', `Thank you for sending your brief${what}. We have started reviewing it.`, '',
    asks.length ? 'To come back with accurate factory options and pricing, could you send:' : 'Your brief gives us what we need to start. Two quick questions so the quote is complete:',
    ...list.map(item => `- ${item}`), ''];
  if (/^yes/i.test(data.design_support || '')) {
    lines.push('You mentioned design support. Our in-house designer can prepare room layouts, a mood board and a product schedule for a fixed fee agreed before we start, credited against your order if you go ahead.', '');
  }
  lines.push('Once we have these, we will come back with factory options and pricing within 48 hours.', '', 'Kind regards,', 'Sai', 'IK ENG | 07767 990007 | ikeng.co.uk');
  return lines.join('\n');
}

// wa.me needs international digits only; UK numbers commonly arrive as 07...
function whatsappNumber(phone) {
  let digits = (phone || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = '44' + digits.slice(1);
  return /^\d{10,15}$/.test(digits) ? digits : '';
}

async function sendEmail({ to, subject, html, text, replyTo, id }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `enquiry-${id}` },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'IK ENG <onboarding@resend.dev>', to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(15000)
  });
  return response.ok;
}

// Optional WhatsApp ping to the owner's own number via CallMeBot. Kept short:
// no email, phone or brief contents leave through this channel.
async function sendWhatsApp(text) {
  const phone = process.env.CALLMEBOT_PHONE, apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) return 'not configured';
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(apikey)}&text=${encodeURIComponent(text)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  return response.ok ? 'sent' : 'failed';
}

exports.handler = async event => {
  let payload;
  try { payload = JSON.parse(event.body || '{}').payload; } catch { return reply(400, { error: 'Invalid event.' }); }
  const form = payload && (payload.form_name || (payload.data || {})['form-name']);
  const spec = FORMS[form];
  if (!spec || !payload.data || typeof payload.data !== 'object') return reply(200, { skipped: true });
  if (clean(payload.data['bot-field'])) return reply(200, { skipped: true });

  const data = {};
  for (const [key, value] of Object.entries(payload.data)) if (!SKIP.has(key)) data[key] = clean(value);
  const id = String(payload.id || payload.number || Date.now()).replace(/[^\w-]/g, '').slice(0, 64);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') && !/[\r\n]/.test(data.email) ? data.email : '';
  const name = (data.name || 'Unknown').replace(/[\r\n]/g, ' ').slice(0, 120);
  const type = spec.enquiry ? data[spec.type] || '' : '';
  const place = spec.enquiry ? data[spec.place] || '' : '';
  const source = data.lead_source || 'unknown';
  const ads = /^google-ads/.test(source);

  const subject = `${spec.enquiry ? 'New enquiry' : 'New lead'}${ads ? ' (Google Ads)' : ''}: ${name}${type ? ' - ' + type : ''}${place ? ' - ' + place : ''}`.slice(0, 200);
  const keys = FIELD_ORDER.filter(key => data[key]).concat(Object.keys(data).filter(key => !FIELD_ORDER.includes(key) && data[key]));
  const rows = keys.map(key => `<tr><td style="padding:6px 10px;border:1px solid #ddd8cc;background:#ede9df;vertical-align:top;white-space:nowrap">${escapeHtml(key.replace(/_/g, ' '))}</td><td style="padding:6px 10px;border:1px solid #ddd8cc;white-space:pre-wrap">${escapeHtml(data[key])}</td></tr>`).join('');

  let draftHtml = '', draftText = '';
  if (spec.enquiry) {
    const draft = draftReply(form, data);
    const wa = whatsappNumber(data.phone);
    const mailto = email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your IK ENG brief - a few details')}&body=${encodeURIComponent(draft)}` : '';
    const buttons = [mailto && `<a href="${escapeHtml(mailto)}" style="display:inline-block;background:#1d6b5e;color:#fff;padding:11px 18px;text-decoration:none;margin:0 8px 8px 0">Send draft by email</a>`,
      wa && `<a href="${escapeHtml('https://wa.me/' + wa + '?text=' + encodeURIComponent(draft))}" style="display:inline-block;background:#075e54;color:#fff;padding:11px 18px;text-decoration:none;margin:0 8px 8px 0">Send draft on WhatsApp</a>`,
      wa && `<a href="tel:+${wa}" style="display:inline-block;background:#c8922a;color:#16140f;padding:11px 18px;text-decoration:none;margin:0 8px 8px 0">Call ${escapeHtml(data.phone)}</a>`].filter(Boolean).join('');
    draftHtml = `<h2 style="font-family:Georgia,serif;font-size:20px;margin:24px 0 8px">Reply draft (review before sending)</h2><div>${buttons}</div><pre style="white-space:pre-wrap;background:#f8f5ef;border-left:3px solid #c8922a;padding:14px;font-family:Arial,sans-serif;font-size:14px">${escapeHtml(draft)}</pre>`;
    draftText = `\n\nREPLY DRAFT (review before sending)\n\n${draft}\n${wa ? `\nWhatsApp: https://wa.me/${wa}` : ''}`;
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;color:#16140f;line-height:1.5">
    <div style="background:#1a1a18;color:#c8922a;padding:16px 20px;font-size:18px">IK ENG - ${escapeHtml(spec.label)}${ads ? ' <span style="color:#fff">(Google Ads)</span>' : ''}</div>
    <div style="padding:16px 20px"><p style="margin:0 0 12px">Source: <strong>${escapeHtml(source)}</strong>. Reply to this email to answer ${escapeHtml(name)} directly.</p>
    ${draftHtml}
    <h2 style="font-family:Georgia,serif;font-size:20px;margin:24px 0 8px">Submitted details</h2>
    <table style="border-collapse:collapse;font-size:14px;width:100%">${rows}</table>
    <p style="font-size:12px;color:#8a8070;margin-top:20px">Netlify Forms keeps the full submission. This alert was sent automatically.</p></div></div>`;
  const text = `${subject}\nSource: ${source}${draftText}\n\nSUBMITTED DETAILS\n${keys.map(key => `${key.replace(/_/g, ' ')}: ${data[key]}`).join('\n')}`;

  const result = { email: 'not configured', whatsapp: 'skipped' };
  const tasks = [];
  if (process.env.RESEND_API_KEY) {
    tasks.push(sendEmail({ to: process.env.ENQUIRY_ALERT_EMAIL || 'sai@ikeng.co.uk', subject, html, text, replyTo: email, id })
      .then(ok => { result.email = ok ? 'sent' : 'failed'; }).catch(() => { result.email = 'failed'; }));
  }
  if (spec.enquiry) {
    const ping = `New IK ENG enquiry${ads ? ' (Google Ads)' : ''}: ${name.split(' ')[0]}${type ? ', ' + type : ''}. Reply draft is in your email.`;
    tasks.push(sendWhatsApp(ping).then(status => { result.whatsapp = status; }).catch(() => { result.whatsapp = 'failed'; }));
  }
  await Promise.all(tasks);
  console.log(`enquiry alert ${form} ${id}: email ${result.email}, whatsapp ${result.whatsapp}`);
  return reply(200, result);
};

exports._test = { draftReply, whatsappNumber };
