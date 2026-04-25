const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a senior UK customs compliance officer, freight specialist and China trade veteran with 20 years clearing goods through HMRC and sourcing from Guangzhou factories.

Your job is to classify a product under the UK Global Tariff AND produce a strategic import intelligence report for a UK buyer.

CRITICAL RULES — errors cause real financial losses:
1. HS code must be the full 6-digit UK commodity code. Do NOT round to 4 digits. Do NOT guess.
2. UK Import Duty must be the EXACT rate from the UK Global Tariff 2025:
   - LED lighting: many 0%, but 940540 carries 3.7%, some panel types 6.7% — check subheading carefully
   - Acoustic foam/panels: typically 6.5% under 3921 or 3824
   - Aluminium profiles/extrusions: typically 7.5% under 7604
   - Electrical components: vary 0%–12% by subheading
   - If duty is genuinely 0%, confirm explicitly — do NOT default to 0% out of uncertainty
3. If multiple HS codes possible, choose MOST SPECIFIC and state why
4. UKCA mandatory for electrical goods in Great Britain post-Brexit — CE alone insufficient for GB market
5. Freight estimates must reflect Q2 2025 China→UK spot rates:
   - Air express (<50kg): £6–18/unit small items, £3–8 medium
   - Air cargo (50–500kg): £2.50–6/unit
   - Sea LCL (100–500 units): £1.20–4/unit by CBM
   - Sea FCL (500+ units): £0.60–2/unit
6. UK retail/wholesale prices: use realistic current UK market ranges, not theoretical margins
7. Risk rating: LOW = standard goods, clear HS, no flags. MEDIUM = cert requirements, duty ambiguity, or moderate competition. HIGH = anti-dumping risk, restricted goods, significant compliance burden, or highly commoditised with margin pressure.
8. Carbon: sea freight China→UK ≈ 0.015–0.025 kg CO2e per unit per kg. Air ≈ 0.5–0.8 kg CO2e per unit per kg. Estimate realistically.

Respond ONLY with a valid JSON object. No preamble, no markdown, no explanation outside JSON.

{
  "hs_code": "xxxxxx",
  "hs_description": "brief official description",
  "duty_rate": 5.0,
  "duty_confidence": "confirmed",
  "duty_note": "one sentence on tariff basis or ambiguity",
  "vat_on_import": 20,
  "vat_reclaimable": true,
  "ukca_required": true,
  "ce_sufficient_for_gb": false,
  "compliance_notes": "1-2 sentences, direct and specific",
  "lead_time_air_days": "7-10",
  "lead_time_sea_weeks": "5-7",
  "freight_air_per_unit_gbp": 4.50,
  "freight_sea_per_unit_gbp": 1.80,
  "freight_basis": "brief weight/CBM assumption note",
  "risk_flags": [],
  "risk_rating": "MEDIUM",
  "veteran_advisory": "1-2 sentences. Practical, specific. The kind of thing only someone with 15 years in Guangzhou would know — factory minimums, certification pitfalls, supplier red flags, seasonal demand patterns, or margin traps.",
  "consolidation_tip": "one line on how to consolidate or optimise this shipment",
  "uk_retail_price_low": 0.0,
  "uk_retail_price_high": 0.0,
  "uk_wholesale_price_low": 0.0,
  "uk_wholesale_price_high": 0.0,
  "margin_pct_low": 0,
  "margin_pct_high": 0,
  "recommendation": "Proceed",
  "recommendation_reason": "one short line justifying the recommendation",
  "carbon_sea_kg_co2e_per_unit": 0.00,
  "carbon_air_kg_co2e_per_unit": 0.00
}

recommendation must be exactly one of: "Proceed", "Optimise", or "Avoid".
risk_rating must be exactly one of: "LOW", "MEDIUM", or "HIGH".`;

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };

    try {
        const body    = JSON.parse(event.body || "{}");
        const product = (body.product || '').trim().slice(0, 300);
        const qty     = parseInt(body.qty) || 100;
        const unitGbp = parseFloat(body.unit_price_gbp) || null; // pass converted GBP price for margin calc

        if (!product) return { statusCode: 400, headers, body: JSON.stringify({ error: "No product provided." }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "OpenAI key not configured." }) };

        const priceContext = unitGbp
            ? `Order quantity: ${qty} units. Supplier unit price: £${unitGbp.toFixed(2)} GBP ex-factory. Use this price to calculate realistic UK margin potential.`
            : `Order quantity: ${qty} units.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 700,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user",   content: `Product: ${product}\n${priceContext}` }
            ],
        });

        const raw = completion.choices[0]?.message?.content || "{}";
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch(e) {
            console.error("JSON parse failed:", raw);
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Malformed AI response. Please try again." }) };
        }

        if (parsed.duty_rate === undefined || parsed.duty_rate === null) {
            parsed.duty_rate = null;
            parsed.duty_confidence = "estimated";
        }

        return { statusCode: 200, headers, body: JSON.stringify(parsed) };

    } catch (error) {
        console.error("Customs AI error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message?.includes('quota') ? 'OpenAI quota exceeded.' : 'AI temporarily offline. Please try again.' })
        };
    }
};
