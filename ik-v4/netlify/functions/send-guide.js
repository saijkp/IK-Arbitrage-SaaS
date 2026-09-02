const { getStore } = require("@netlify/blobs");

const UNSUB_NOTE = (email) => `You'll also get a couple of practical follow-ups from us over the next week. ` +
    `<a href="https://ikeng.co.uk/unsubscribe.html?email=${encodeURIComponent(email)}" style="color:#1f4e8c;">Unsubscribe anytime</a>.`;

const GUIDE_HTML = (email) => `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#1b1b18;line-height:1.6;">
  <div style="background:#1a1a18;padding:28px 32px;">
    <span style="color:#c8922a;font-family:Arial,sans-serif;font-weight:700;font-size:18px;">IK ENG</span>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:22px;margin:0 0 6px;">Your UK Buyer's Guide to China Sourcing</h1>
    <p style="color:#5b6472;font-family:Arial,sans-serif;font-size:14px;margin:0 0 28px;">Plain English. No jargon. Six things every UK property professional should know before sourcing from China.</p>

    <h2 style="font-size:17px;margin:26px 0 8px;">1. Import duties &amp; VAT — what you actually pay</h2>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 4px;">Most furniture and fittings land under a UK Global Tariff duty rate of 0–7.5%, plus 20% import VAT charged on the goods value, freight, and duty combined (not just the goods). VAT is reclaimable if you're VAT-registered. Get the exact HS code confirmed before you order — guessing it costs you either an overpayment or a customs hold.</p>

    <h2 style="font-size:17px;margin:26px 0 8px;">2. How to spot fake suppliers on Alibaba</h2>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 4px;">A "Verified Supplier" badge confirms a business licence exists — it doesn't confirm the factory actually makes what they're selling you. Ask for real factory photos with today's date visible, a video call showing the production floor, and their business licence cross-checked against the company name on the contract. Traders posing as factories are the single biggest source of quality and delay problems.</p>

    <h2 style="font-size:17px;margin:26px 0 8px;">3. UK fire safety &amp; compliance requirements</h2>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 4px;">Upholstered furniture sold or let in the UK must meet the Furniture and Furnishings (Fire Safety) Regulations — permanent fire safety labels are a legal requirement, not optional. For HMOs and rental property this is enforced at inspection. Confirm compliance labelling in writing before production, not after the container has shipped.</p>

    <h2 style="font-size:17px;margin:26px 0 8px;">4. Sea vs air freight — when to use each</h2>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 4px;">Sea freight (5–7 weeks) is the default for anything bulky or non-urgent — it's a fraction of the cost per unit. Air freight (7–10 days) only makes sense for small, high-value, or genuinely time-critical items where the freight premium is smaller than the cost of a delayed handover. Mixing the two — sea for the bulk order, air for the items holding up completion — is usually the smartest move.</p>

    <h2 style="font-size:17px;margin:26px 0 8px;">5. What to put in your supplier contract</h2>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 4px;">At minimum: an agreed sample as the quality reference, a pre-shipment inspection clause with photo evidence before the container seals, a firm delivery date with penalties for slippage, and payment terms that hold back a meaningful balance until inspection passes. Verbal agreements on WeChat are not a contract.</p>

    <h2 style="font-size:17px;margin:26px 0 8px;">6. Real timelines from order to site</h2>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 4px;">Realistically: 1–2 weeks for sampling and approval, 3–5 weeks production, 5–7 weeks sea freight plus UK customs clearance and final delivery. Budget 10–14 weeks door-to-door for a standard order, and start earlier than feels necessary — the freight leg is the one part you can't compress.</p>

    <div style="margin-top:32px;padding:20px 24px;background:#eaf1fb;border-radius:6px;font-family:Arial,sans-serif;">
      <p style="font-size:14px;margin:0 0 12px;color:#1b1f27;">Have a live project? Send us your brief and we'll come back within 48 hours with factory options, pricing, and a confirmed delivery date.</p>
      <a href="https://ikeng.co.uk/#brief" style="display:inline-block;background:#1f4e8c;color:#fff;padding:10px 18px;border-radius:5px;text-decoration:none;font-weight:600;font-size:14px;">Send your project brief →</a>
    </div>

    <p style="font-family:Arial,sans-serif;font-size:12px;color:#5b6472;margin-top:32px;">IK Eng Ltd · 125 Great Clowes Street, Manchester M7 1AL · <a href="mailto:sai@ikeng.co.uk" style="color:#1f4e8c;">sai@ikeng.co.uk</a></p>
    <p style="font-family:Arial,sans-serif;font-size:11px;color:#8a8070;margin-top:10px;">${UNSUB_NOTE(email)}</p>
  </div>
</div>`;

const DAY3_HTML = (name, email) => `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#1b1b18;line-height:1.6;">
  <div style="background:#1a1a18;padding:28px 32px;">
    <span style="color:#c8922a;font-family:Arial,sans-serif;font-weight:700;font-size:18px;">IK ENG</span>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;margin:0 0 18px;">The maths on your timeline (before it works against you)</h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 16px;">Hi ${name || 'there'},</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 16px;">Quick one. If you're planning a project with any kind of handover date, here's the number that matters: sourcing from China typically runs 10–12 weeks door-to-site — 3–5 weeks production, 5 weeks sea freight, 1 week customs and delivery.</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 16px;">That means today's date already tells you your last sensible start date. Every week you sit on a brief is a week that comes off the other end — either a later handover, or a scramble into air freight at a much higher cost.</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 24px;">Here's what it looks like when the timeline holds: <a href="https://ikeng.co.uk/case-study-manchester-hmo.html" style="color:#1f4e8c;">24-Unit HMO Scheme, Manchester</a> — factory options in 48 hours, delivered inside 12 weeks, no surprises.</p>
    <a href="https://ikeng.co.uk/#brief" style="display:inline-block;background:#1f4e8c;color:#fff;padding:12px 22px;border-radius:5px;text-decoration:none;font-weight:600;font-size:14px;">Send your brief now →</a>
    <p style="font-family:Arial,sans-serif;font-size:13px;color:#5b6472;margin-top:20px;">Free to enquire, no obligation — and it's the only step that starts the clock.</p>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#5b6472;margin-top:32px;">IK Eng Ltd · 125 Great Clowes Street, Manchester M7 1AL · <a href="mailto:sai@ikeng.co.uk" style="color:#1f4e8c;">sai@ikeng.co.uk</a></p>
    <p style="font-family:Arial,sans-serif;font-size:11px;color:#8a8070;margin-top:10px;"><a href="https://ikeng.co.uk/unsubscribe.html?email=${encodeURIComponent(email)}" style="color:#8a8070;">Unsubscribe from these follow-ups</a></p>
  </div>
</div>`;

const DAY7_HTML = (name, email) => `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#1b1b18;line-height:1.6;">
  <div style="background:#1a1a18;padding:28px 32px;">
    <span style="color:#c8922a;font-family:Arial,sans-serif;font-weight:700;font-size:18px;">IK ENG</span>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;margin:0 0 18px;">Still deciding? Here's what that's costing you</h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 16px;">Hi ${name || 'there'},</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 16px;">No pressure, but a straight answer: waiting on this doesn't hold your options in place — it just shortens your production and freight window when you do start.</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 8px;">A few things that stop people sending a brief, and why they shouldn't:</p>
    <ul style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 20px;padding-left:20px;">
      <li style="margin-bottom:8px;"><strong>"I don't have a full spec yet"</strong> — you don't need one. A mood board or a rough description is enough to get options back within 48–72 hours.</li>
      <li style="margin-bottom:8px;"><strong>"What if it's not worth it for my order size?"</strong> — there's no minimum, and if your order genuinely isn't economical we'll tell you straight, not string you along.</li>
      <li style="margin-bottom:8px;"><strong>"What does it cost to find out?"</strong> — nothing. £0 to enquire.</li>
    </ul>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 24px;">I only take on what I can give proper attention to, so the earlier your brief lands, the more room there is to get you the best options.</p>
    <a href="https://ikeng.co.uk/#brief" style="display:inline-block;background:#1f4e8c;color:#fff;padding:12px 22px;border-radius:5px;text-decoration:none;font-weight:600;font-size:14px;">Send your brief →</a>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#5b6472;margin-top:32px;">IK Eng Ltd · 125 Great Clowes Street, Manchester M7 1AL · <a href="mailto:sai@ikeng.co.uk" style="color:#1f4e8c;">sai@ikeng.co.uk</a></p>
    <p style="font-family:Arial,sans-serif;font-size:11px;color:#8a8070;margin-top:10px;"><a href="https://ikeng.co.uk/unsubscribe.html?email=${encodeURIComponent(email)}" style="color:#8a8070;">Unsubscribe from these follow-ups</a></p>
  </div>
</div>`;

async function sendResendEmail(fromAddress, to, subject, html, scheduledAt) {
    const payload = { from: fromAddress, to: [to], subject, html };
    if (scheduledAt) payload.scheduled_at = scheduledAt;

    const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const errText = await resp.text();
        console.error("Resend send failed:", resp.status, subject, errText);
        return null;
    }
    const data = await resp.json();
    return data.id || null;
}

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };

    try {
        const body = JSON.parse(event.body || "{}");
        const name = (body.name || '').trim().slice(0, 200);
        const email = (body.email || '').trim().slice(0, 320).toLowerCase();

        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid name and email required." }) };
        }
        if (!process.env.RESEND_API_KEY) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Resend not configured." }) };
        }

        const fromAddress = process.env.RESEND_FROM_EMAIL || "IK ENG <onboarding@resend.dev>";
        console.log("send-guide: sending via", fromAddress);

        const store = getStore("nurture-leads");
        const existing = await store.get(email, { type: "json" });
        if (existing && existing.unsubscribed) {
            // Respect a prior unsubscribe - still send the guide itself (they asked for it now),
            // but never schedule the follow-ups.
            const guideId = await sendResendEmail(fromAddress, email, "Your UK Buyer's Guide to China Sourcing", GUIDE_HTML(email));
            if (!guideId) return { statusCode: 502, headers, body: JSON.stringify({ error: "Email send failed." }) };
            return { statusCode: 200, headers, body: JSON.stringify({ sent: true, nurture: false }) };
        }

        const guideId = await sendResendEmail(fromAddress, email, "Your UK Buyer's Guide to China Sourcing", GUIDE_HTML(email));
        if (!guideId) {
            return { statusCode: 502, headers, body: JSON.stringify({ error: "Email send failed." }) };
        }

        const day3At = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const day7At = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const day3Id = await sendResendEmail(fromAddress, email, "The maths on your timeline (before it works against you)", DAY3_HTML(name, email), day3At);
        const day7Id = await sendResendEmail(fromAddress, email, "Still deciding? Here's what that's costing you", DAY7_HTML(name, email), day7At);

        await store.setJSON(email, {
            email, name,
            guideId, day3Id, day7Id,
            unsubscribed: false,
            createdAt: new Date().toISOString()
        });

        return { statusCode: 200, headers, body: JSON.stringify({ sent: true, nurture: true }) };

    } catch (error) {
        console.error("send-guide error:", error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Send failed. Please try again." }) };
    }
};
