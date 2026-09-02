const { getStore } = require("@netlify/blobs");

async function cancelResendEmail(id) {
    if (!id) return;
    try {
        const resp = await fetch(`https://api.resend.com/emails/${id}/cancel`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}` }
        });
        if (!resp.ok && resp.status !== 404) {
            const errText = await resp.text();
            console.warn("Resend cancel non-fatal failure:", id, resp.status, errText);
        }
    } catch (e) {
        console.warn("Resend cancel request failed:", id, e.message);
    }
}

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };

    try {
        const email = ((event.queryStringParameters && event.queryStringParameters.email) || '').trim().toLowerCase().slice(0, 320);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid email required." }) };
        }

        const store = getStore("nurture-leads");
        const record = await store.get(email, { type: "json" });

        if (record) {
            await cancelResendEmail(record.day3Id);
            await cancelResendEmail(record.day7Id);
            await store.setJSON(email, { ...record, unsubscribed: true, unsubscribedAt: new Date().toISOString() });
        } else {
            // No prior send record - still record the opt-out so a future guide request won't schedule follow-ups.
            await store.setJSON(email, { email, unsubscribed: true, unsubscribedAt: new Date().toISOString() });
        }

        return { statusCode: 200, headers, body: JSON.stringify({ unsubscribed: true }) };

    } catch (error) {
        console.error("unsubscribe error:", error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Something went wrong. Please email sai@ikeng.co.uk to unsubscribe." }) };
    }
};
