const axios = require('axios');

let cachedRate = null;
let cacheTime  = 0;

async function getExchangeRate() {
    const now = Date.now();
    if (cachedRate && (now - cacheTime) < 60 * 60 * 1000) return cachedRate;
    const res = await axios.get('https://open.er-api.com/v6/latest/CNY', { timeout: 5000 });
    cachedRate = res.data.rates.GBP;
    cacheTime  = now;
    return cachedRate;
}

// ── PRICING CONSTANTS ──
const MIN_SERVICE_FEE       = 199;    // £199 minimum — covers labour on small orders
const SERVICE_RATE          = 0.05;   // 5% QA & Factory Liaison
const PORT_AIR              = 45;     // fixed air port/doc fee
const SEA_PORT_FEE          = 145;    // 2026 UK LCL levies
const AIR_FREIGHT_DEFAULT   = 4.50;   // £/unit fallback
const SEA_FREIGHT_DEFAULT   = 1.80;   // £/unit fallback
const DUTY_DEFAULT          = 0.05;   // 5% fallback — AI gives real rate on dashboard
const AMAZON_FBA_RATE       = 0.15;   // 15% Amazon referral fee
const AMAZON_FBA_FULFILMENT = 2.50;   // £2.50/unit FBA pick & pack

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };

    try {
        const body           = JSON.parse(event.body || "{}");
        const q              = (body.q || '').trim();
        const liveAmazonPrice = parseFloat(body.livePrice) || 0;

        if (!q) return { statusCode: 200, headers, body: JSON.stringify([]) };

        const apiKey = process.env.YOUR_RAPID_API_KEY;
        if (!apiKey) throw new Error('RapidAPI key not configured on server.');

        const cnyToGbpRate = await getExchangeRate();

        const response = await axios.get('https://otapi-1688.p.rapidapi.com/BatchSearchItemsFrame', {
            params: { language: 'en', framePosition: '0', frameSize: '20', ItemTitle: q, providerType: 'Alibaba1688' },
            headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'otapi-1688.p.rapidapi.com' },
            timeout: 10000
        });

        const items = response.data?.Result?.Items?.Items?.Content || [];
        if (items.length === 0) return { statusCode: 200, headers, body: JSON.stringify([]) };

        const results = items.map(item => {
            const priceCNY   = parseFloat(item.Price?.OriginalPrice || item.Price?.Value || 0);
            const productGBP = priceCNY * cnyToGbpRate;

            // ── Benchmark at 100 units ──
            const qty              = 100;
            const totalProductCost = productGBP * qty;

            // ── SERVICE FEE: correctly amortised ──
            // Calculate total fee first (applying floor), then divide back to per-unit
            const totalSourcingFee  = Math.max(MIN_SERVICE_FEE, totalProductCost * SERVICE_RATE);
            const unitSourcingFee   = totalSourcingFee / qty;

            // ── AIR LANDED ──
            const airFreightPerUnit = AIR_FREIGHT_DEFAULT;
            const airPortPerUnit    = PORT_AIR / qty;
            const airSubPerUnit     = productGBP + airFreightPerUnit + unitSourcingFee + airPortPerUnit;
            const airDutyPerUnit    = airSubPerUnit * DUTY_DEFAULT;
            const airLandedPerUnit  = airSubPerUnit + airDutyPerUnit;

            // ── SEA LANDED ──
            const seaFreightPerUnit = SEA_FREIGHT_DEFAULT;
            const seaPortPerUnit    = SEA_PORT_FEE / qty;
            const seaSubPerUnit     = productGBP + seaFreightPerUnit + unitSourcingFee + seaPortPerUnit;
            const seaDutyPerUnit    = seaSubPerUnit * DUTY_DEFAULT;
            const seaLandedPerUnit  = seaSubPerUnit + seaDutyPerUnit;

            // ── PROFIT — Sea primary (best margins for 100+ units) ──
            let sea_profit = 0, air_profit = 0, roi = '';
            if (liveAmazonPrice > 0) {
                // Subtract: landed cost + Amazon referral % + FBA fulfilment + amortised sourcing fee
                sea_profit = liveAmazonPrice
                    - seaLandedPerUnit
                    - (liveAmazonPrice * AMAZON_FBA_RATE)
                    - AMAZON_FBA_FULFILMENT;
                air_profit = liveAmazonPrice
                    - airLandedPerUnit
                    - (liveAmazonPrice * AMAZON_FBA_RATE)
                    - AMAZON_FBA_FULFILMENT;
                if (seaLandedPerUnit > 0) {
                    roi = ((sea_profit / seaLandedPerUnit) * 100).toFixed(0) + '%';
                }
            }

            const rawImg  = (item.MainPictureUrl || item.ImageUrl || '').replace('http:', 'https:');
            const rawId   = item.ItemId || item.Id || "";
            const cleanId = String(rawId).replace(/\D/g, "");

            return {
                title:       item.Title || '1688 Product',
                product_gbp: productGBP.toFixed(4),
                sea_profit:  sea_profit.toFixed(2),
                air_profit:  air_profit.toFixed(2),
                net_profit:  sea_profit.toFixed(2),
                roi,
                landed_air:  airLandedPerUnit.toFixed(2),
                landed_sea:  seaLandedPerUnit.toFixed(2),
                landed_gbp:  airLandedPerUnit.toFixed(2),
                img:  rawImg,
                link: cleanId ? `https://detail.1688.com/offer/${cleanId}.html` : '#'
            };
        }).filter(r => parseFloat(r.product_gbp) > 0);

        return { statusCode: 200, headers, body: JSON.stringify(results) };

    } catch (error) {
        console.error('Search error:', error.message);
        const msg = error.message.includes('timeout') ? 'Search timed out. Please try again.'
            : error.message.includes('key') ? 'API key not configured. Contact support.'
            : 'Search failed. Please try again.';
        return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
    }
};
