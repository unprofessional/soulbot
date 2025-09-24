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

function parseExtract(url, isXDotCom) {
    const urlPattern = isXDotCom ? 'https://x.com/' : 'https://twitter.com/';
    return url.split(urlPattern)[1]; // e.g., user/status/12345
}

async function fetchMetadata(url, message, isXDotCom, log = console.log) {
    const extracted = parseExtract(url, isXDotCom);
    if (!extracted) return buildError({ status: 0, error: 'Bad URL parse', source: 'client' });

    // Prefer VX first; FX second. (VX has been stabler lately)
    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([vx, fx], { log });

    // If nothing useful came back
    if (!res || (!res.ok && !res.json && !res.text)) {
        return buildError({ status: res?.status, text: res?.text, error: res?.error, source: res?.url });
    }

    const j = res.json;

    // VX success shapes
    if (j && (j.tweetID || j.user_name)) {
        return normalizeFromVX(j);
    }

    // FX success or FX error payloads (many FX errors include `code` or `tweet`)
    if (j && (j.tweet || typeof j.code === 'number')) {
        return normalizeFromFX(j);
    }

    // Generic JSON error shape
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

    // Non-JSON or unexpected shape
    return buildError({ status: res.status, text: res.text, error: 'Unexpected response', source: res.url });
}

async function fetchQTMetadata(url, log = console.log) {
    const extracted = url.split('https://twitter.com/')[1] || url.split('https://x.com/')[1];
    if (!extracted) return buildError({ status: 0, error: 'Bad QT URL parse', source: 'client' });

    // Prefer VX first
    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([vx, fx], { log });
    if (!res || (!res.ok && !res.json && !res.text)) {
        return buildError({ status: res?.status, text: res?.text, error: res?.error, source: res?.url });
    }

    const j = res.json;

    if (j && (j.tweetID || j.user_name)) return normalizeFromVX(j);
    if (j && (j.tweet || typeof j.code === 'number')) return normalizeFromFX(j);

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
