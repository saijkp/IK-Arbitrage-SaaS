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

const MIN_SERVICE_FEE       = 199;
const SERVICE_RATE          = 0.05;
const PORT_AIR              = 45;
const SEA_PORT_FEE          = 145;
const AIR_FREIGHT_DEFAULT   = 4.50;
const SEA_FREIGHT_DEFAULT   = 1.80;
const DUTY_DEFAULT          = 0.05;
const AMAZON_FBA_RATE       = 0.15;
const AMAZON_FBA_FULFILMENT = 2.50;

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };

    try {
        const body       = JSON.parse(event.body || "{}");
        const livePrice  = parseFloat(body.livePrice) || 0;
        const imageUrl   = (body.imageUrl || '').trim();

        if (!imageUrl) return { statusCode: 400, headers, body: JSON.stringify({ error: "No image URL provided" }) };

        const apiKey = process.env.YOUR_RAPID_API_KEY;
        if (!apiKey) throw new Error('RapidAPI key not configured on server.');

        const cnyToGbpRate = await getExchangeRate();

        const response = await axios.get('https://otapi-1688.p.rapidapi.com/BatchSearchItemsFrame', {
            params: { language: 'en', framePosition: '0', frameSize: '10', ImageUrl: imageUrl, providerType: 'Alibaba1688' },
            headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'otapi-1688.p.rapidapi.com' },
            timeout: 12000
        });

        const items = response.data?.Result?.Items?.Items?.Content || [];
        if (items.length === 0) return { statusCode: 200, headers, body: JSON.stringify([]) };

        const results = items.map(item => {
            const rawId    = item.ItemId || item.num_iid || item.offerId || item.Id || "";
            const actualId = String(rawId).replace(/\D/g, "");

            const priceCNY   = parseFloat(item.Price?.OriginalPrice || item.Price?.Value || 0);
            const productGBP = priceCNY * cnyToGbpRate;

            const qty              = 100;
            const totalProductCost = productGBP * qty;
            const totalSourcingFee  = Math.max(MIN_SERVICE_FEE, totalProductCost * SERVICE_RATE);
            const unitSourcingFee   = totalSourcingFee / qty;

            const airFreightPerUnit = AIR_FREIGHT_DEFAULT;
            const airPortPerUnit    = PORT_AIR / qty;
            const airSubPerUnit     = productGBP + airFreightPerUnit + unitSourcingFee + airPortPerUnit;
            const airDutyPerUnit    = airSubPerUnit * DUTY_DEFAULT;
            const airLandedPerUnit  = airSubPerUnit + airDutyPerUnit;

            const seaFreightPerUnit = SEA_FREIGHT_DEFAULT;
            const seaPortPerUnit    = SEA_PORT_FEE / qty;
            const seaSubPerUnit     = productGBP + seaFreightPerUnit + unitSourcingFee + seaPortPerUnit;
            const seaDutyPerUnit    = seaSubPerUnit * DUTY_DEFAULT;
            const seaLandedPerUnit  = seaSubPerUnit + seaDutyPerUnit;

            let sea_profit = 0, air_profit = 0, roi = '';
            if (livePrice > 0) {
                sea_profit = livePrice - seaLandedPerUnit - (livePrice * AMAZON_FBA_RATE) - AMAZON_FBA_FULFILMENT;
                air_profit = livePrice - airLandedPerUnit - (livePrice * AMAZON_FBA_RATE) - AMAZON_FBA_FULFILMENT;
                if (seaLandedPerUnit > 0) roi = ((sea_profit / seaLandedPerUnit) * 100).toFixed(0) + '%';
            }

            const rawImg     = (item.MainPictureUrl || item.ImageUrl || '').replace('http:', 'https:');
            const proxiedImg = `https://wsrv.nl/?url=${encodeURIComponent(rawImg)}&w=300&h=300&fit=cover`;

            return {
                title:       item.Title || '1688 Match',
                product_gbp: productGBP.toFixed(4),
                sea_profit:  sea_profit.toFixed(2),
                air_profit:  air_profit.toFixed(2),
                net_profit:  sea_profit.toFixed(2),
                roi,
                landed_air:  airLandedPerUnit.toFixed(2),
                landed_sea:  seaLandedPerUnit.toFixed(2),
                landed_gbp:  airLandedPerUnit.toFixed(2),
                img:      proxiedImg,
                raw_img:  rawImg,
                link: actualId ? `https://detail.1688.com/offer/${actualId}.html` : '#'
            };
        }).filter(r => parseFloat(r.product_gbp) > 0);

        return { statusCode: 200, headers, body: JSON.stringify(results) };

    } catch (error) {
        console.error("Image Search Error:", error.message);
        const msg = error.message.includes('timeout')
            ? 'Image search timed out. Please try again.'
            : 'Image search failed. Please try a keyword search instead.';
        return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
    }
};
