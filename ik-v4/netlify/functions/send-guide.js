const GUIDE_HTML = `
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
  </div>
</div>`;

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
        const email = (body.email || '').trim().slice(0, 320);

        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid name and email required." }) };
        }
        if (!process.env.RESEND_API_KEY) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Resend not configured." }) };
        }

        const fromAddress = process.env.RESEND_FROM_EMAIL || "IK ENG <onboarding@resend.dev>";

        const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [email],
                subject: "Your UK Buyer's Guide to China Sourcing",
                html: GUIDE_HTML
            })
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error("Resend send failed:", resp.status, errText);
            return { statusCode: 502, headers, body: JSON.stringify({ error: "Email send failed." }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) };

    } catch (error) {
        console.error("send-guide error:", error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Send failed. Please try again." }) };
    }
};
