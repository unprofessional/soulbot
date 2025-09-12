// features/twitter-core/thread_snapshot_utils.js
const { getJsonWithFallback } = require('./http');
const { normalizeFromVX, normalizeFromFX } = require('./fxvx_normalize');

/** Fetch tweet data by ID using FX primary, VX fallback. */
async function fetchTweetById(tweetID, log = console.log) {
    const urls = [
        `https://api.fxtwitter.com/status/${tweetID}`,            // FX primary
        `https://api.vxtwitter.com/status/${tweetID}`,            // VX fallback
        `https://api.vxtwitter.com/Twitter/status/${tweetID}`,    // legacy path
    ];

    const res = await getJsonWithFallback(urls, { log });
    if (!res.ok && !res.json) {
        log?.(`❌ fetchTweetById failed: status=${res.status} err=${res.error || res.text?.slice(0,120)}`);
        return null;
    }

    if (res.json?.tweetID || res.json?.user_name) {
    // VX shape
        return normalizeFromVX(res.json);
    }

    if (typeof res.json === 'object' && ('tweet' in res.json || 'code' in res.json)) {
    // FX shape
        if (res.json.code === 401 && res.json.message === 'PRIVATE_TWEET') {
            log?.('🔒 Tweet is private.');
            return null;
        }
        if (res.json.code === 404 && res.json.message === 'NOT_FOUND') {
            log?.('❓ Tweet not found.');
            return null;
        }
        const mapped = normalizeFromFX(res.json);
        if (!mapped) return null;
        return mapped;
    }

    // Non-JSON or unexpected body
    log?.(`⚠️ Unexpected response body: ${res.text?.slice(0,180)}`);
    return null;
}

module.exports = { fetchTweetById };
