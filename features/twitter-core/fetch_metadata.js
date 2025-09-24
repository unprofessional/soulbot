// features/twitter-core/fetch_metadata.js
const { getJsonWithFallback } = require('./http');
const { normalizeFromVX, normalizeFromFX } = require('./fxvx_normalize');

function toFixupx(link) {
    if (!link) return undefined;
    return link
        .replace('https://twitter.com', 'https://fixupx.com')
        .replace('https://x.com', 'https://fixupx.com');
}

function stripHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function summarizeUpstreamFailure({ status, text = '', ct = '', source }) {
    const isHtml = ct && ct.includes('text/html');
    const raw = isHtml ? stripHtml(text) : (text || '');
    const hint = /failed to scan/i.test(raw)
        ? 'Provider could not scan the tweet link.'
        : (raw ? raw.slice(0, 160) : 'Upstream returned an unexpected response.');

    return {
        error: true,
        status: typeof status === 'number' ? status : 0,
        message: `${hint} Defaulting to a FIXUPX link.`,
        _source: source,
        // For callers that want to render a fallback
        fallback_link: undefined, // set by caller-aware helpers below
    };
}

function buildError({ status, text, error, source, ct }) {
    // Never leak big HTML blobs to users; keep it summarized.
    const summary = summarizeUpstreamFailure({ status, text, ct, source });
    return summary;
}

function parseExtract(url, isXDotCom) {
    const urlPattern = isXDotCom ? 'https://x.com/' : 'https://twitter.com/';
    return url.split(urlPattern)[1]; // e.g., user/status/12345
}

/**
 * Returns either a normalized tweet object, or an error object:
 * {
 *   error: true,
 *   status,
 *   message,           // summarized
 *   _source,           // which upstream produced the terminal error
 *   fallback_link,     // fixupx.com version of the original link (if provided)
 * }
 */
async function fetchMetadata(url, message, isXDotCom, log = console.log) {
    const extracted = parseExtract(url, isXDotCom);
    if (!extracted) return buildError({ status: 0, error: 'Bad URL parse', source: 'client' });

    // Prefer VX first; FX second
    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([vx, fx], { log });

    // If nothing useful came back
    if (!res || (!res.ok && !res.json && !res.text)) {
        const err = buildError({ status: res?.status, text: res?.text, error: res?.error, source: res?.url, ct: res?.ct });
        err.fallback_link = toFixupx(url);
        return err;
    }

    const j = res.json;

    // VX success
    if (j && (j.tweetID || j.user_name)) {
        return normalizeFromVX(j);
    }

    // FX success or FX error payloads
    if (j && (j.tweet || typeof j.code === 'number')) {
        return normalizeFromFX(j);
    }

    // Generic JSON error shape
    if (j && (j.error || j.message)) {
        const err = summarizeUpstreamFailure({ status: typeof j.code === 'number' ? j.code : res.status, text: String(j.message || j.error), ct: res.ct, source: res.url });
        err.fallback_link = toFixupx(url);
        return err;
    }

    // Non-JSON or unexpected shape (e.g., HTML page)
    const err = buildError({ status: res.status, text: res.text, source: res.url, ct: res.ct });
    err.fallback_link = toFixupx(url);
    return err;
}

async function fetchQTMetadata(url, log = console.log) {
    const extracted = url.split('https://twitter.com/')[1] || url.split('https://x.com/')[1];
    if (!extracted) return buildError({ status: 0, error: 'Bad QT URL parse', source: 'client' });

    // Prefer VX first; FX second
    const vx = `https://api.vxtwitter.com/${extracted}`;
    const fx = `https://api.fxtwitter.com/${extracted}`;

    const res = await getJsonWithFallback([vx, fx], { log });

    if (!res || (!res.ok && !res.json && !res.text)) {
        const err = buildError({ status: res?.status, text: res?.text, error: res?.error, source: res?.url, ct: res?.ct });
        err.fallback_link = toFixupx(url);
        return err;
    }

    const j = res.json;

    if (j && (j.tweetID || j.user_name)) return normalizeFromVX(j);
    if (j && (j.tweet || typeof j.code === 'number')) return normalizeFromFX(j);

    if (j && (j.error || j.message)) {
        const err = summarizeUpstreamFailure({ status: typeof j.code === 'number' ? j.code : res.status, text: String(j.message || j.error), ct: res.ct, source: res.url });
        err.fallback_link = toFixupx(url);
        return err;
    }

    const err = buildError({ status: res.status, text: res.text, source: res.url, ct: res.ct });
    err.fallback_link = toFixupx(url);
    return err;
}

module.exports = { toFixupx, fetchMetadata, fetchQTMetadata };
