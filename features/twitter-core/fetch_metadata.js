// features/twitter-core/fetch_metadata.js
const { getJsonWithFallback } = require('./http');
const { normalizeFromVX, normalizeFromFX } = require('./fxvx_normalize');

function buildError({ status, text, error, source }) {
    return {
        error: true,
        _fx_code: typeof status === 'number' ? status : undefined, // keep existing field name
        status,
        message: status ? `HTTP ${status}` : (error || 'Request failed'),
        details: (typeof text === 'string' ? text.slice(0, 200) : '') || undefined,
        _source: source,
    };
}

async function fetchMetadata(url, message, isXDotCom, log = console.log) {
    const urlPattern = isXDotCom ? 'https://x.com/' : 'https://twitter.com/';
    const extracted = url.split(urlPattern)[1]; // e.g., user/status/12345
    if (!extracted) return buildError({ status: 0, error: 'Bad URL parse', source: 'client' });

    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([fx, vx], { log });
    // If fetch failed outright or no JSON available, surface the HTTP status cleanly.
    if (!res || (!res.ok && !res.json)) {
        return buildError({ status: res?.status, text: res?.text, error: res?.error, source: res?.url });
    }

    const j = res.json;

    // VX success
    if (j?.tweetID || j?.user_name) return normalizeFromVX(j);

    // FX success or FX error payloads (many FX errors include `code`)
    if (j?.tweet || typeof j?.code === 'number') return normalizeFromFX(j);

    // If response clearly indicates not found/private in another shape, map to error.
    if (j && (j.error || j.message)) {
        return {
            error: true,
            _fx_code: typeof j.code === 'number' ? j.code : res.status,
            status: typeof j.code === 'number' ? j.code : res.status,
            message: String(j.message || j.error),
            details: typeof res.text === 'string' ? res.text.slice(0, 200) : undefined,
            _source: res.url,
        };
    }

    return buildError({ status: res.status, text: res.text, error: 'Unexpected response', source: res.url });
}

async function fetchQTMetadata(url, log = console.log) {
    const extracted = url.split('https://twitter.com/')[1] || url.split('https://x.com/')[1];
    if (!extracted) return buildError({ status: 0, error: 'Bad QT URL parse', source: 'client' });

    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([fx, vx], { log });
    if (!res || (!res.ok && !res.json)) {
        return buildError({ status: res?.status, text: res?.text, error: res?.error, source: res?.url });
    }

    const j = res.json;

    if (j?.tweetID || j?.user_name) return normalizeFromVX(j);
    if (j?.tweet || typeof j?.code === 'number') return normalizeFromFX(j);

    if (j && (j.error || j.message)) {
        return {
            error: true,
            _fx_code: typeof j.code === 'number' ? j.code : res.status,
            status: typeof j.code === 'number' ? j.code : res.status,
            message: String(j.message || j.error),
            details: typeof res.text === 'string' ? res.text.slice(0, 200) : undefined,
            _source: res.url,
        };
    }

    return buildError({ status: res.status, text: res.text, error: 'Unexpected response', source: res.url });
}

module.exports = { fetchMetadata, fetchQTMetadata };
