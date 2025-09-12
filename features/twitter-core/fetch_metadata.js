// features/twitter-core/fetch_metadata.js
const { getJsonWithFallback } = require('./http');
const { normalizeFromVX, normalizeFromFX } = require('./fxvx_normalize');

async function fetchMetadata(url, message, isXDotCom, log = console.log) {
    const urlPattern = isXDotCom ? 'https://x.com/' : 'https://twitter.com/';
    const extracted = url.split(urlPattern)[1]; // e.g. DataRepublican/status/12345
    if (!extracted) return { error: true, message: 'Bad URL parse' };

    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([fx, vx], { log });
    if (!res.ok && !res.json) {
        return { error: true, message: `HTTP ${res.status}`, details: res.text?.slice(0,200) || res.error };
    }

    const j = res.json;
    if (j?.tweetID || j?.user_name) return normalizeFromVX(j);   // VX
    if (j?.tweet || typeof j?.code === 'number') return normalizeFromFX(j); // FX

    return { error: true, message: 'Unexpected response', details: res.text?.slice(0,200) };
}

async function fetchQTMetadata(url, log = console.log) {
    const extracted = url.split('https://twitter.com/')[1] || url.split('https://x.com/')[1];
    if (!extracted) return { error: true, message: 'Bad QT URL parse' };

    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([fx, vx], { log });
    if (!res.ok && !res.json) {
        return { error: true, message: `HTTP ${res.status}`, details: res.text?.slice(0,200) || res.error };
    }

    const j = res.json;
    if (j?.tweetID || j?.user_name) return normalizeFromVX(j);
    if (j?.tweet || typeof j?.code === 'number') return normalizeFromFX(j);

    return { error: true, message: 'Unexpected response', details: res.text?.slice(0,200) };
}

module.exports = { fetchMetadata, fetchQTMetadata };
