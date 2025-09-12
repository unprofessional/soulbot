// features/twitter-core/utils.js

const crypto = require("crypto");

/**
 * Safe, locale-aware formatter. You can pass:
 *  - The full tweet/meta object (recommended)
 *  - A Date
 *  - An ISO/epoch value
 * Returns '' if not parseable.
 */
function formatTwitterDate(input, {
    locale = 'en-US',
    timeZone, // e.g. 'UTC' if you want, otherwise system/Node default
} = {}) {
    const dt = coerceTweetDate(input);
    if (!dt) return '';

    try {
        return dt.toLocaleString(locale, {
            timeZone,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
    // Fallback: ISO
        return dt.toISOString();
    }
}

function getExtensionFromMediaUrl(mediaUrl) {
    if (typeof mediaUrl !== 'string') {
        console.warn('getExtensionFromMediaUrl received non-string input:', mediaUrl);
        return null;
    }
    const mediaUrlParts = mediaUrl.split('.');
    const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
    return fileExtensionWithQueryParams.split('?')[0];
}

const removeTCOLink = (text) => {
    if(!text) {
        return '';
    }
    const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/;
    const filteredText = text.replace(shortTwitterUrlPattern, '');
    return filteredText;
};

const stripQueryParams = (url) => {
    try {
        const urlOrigin = new URL(url).origin;
        console.log('>>>>> urlOrigin: ', urlOrigin);
        const urlPathname = new URL(url).pathname;
        console.log('>>>>> urlPathname: ', urlPathname);
        return urlOrigin + urlPathname;
    } catch (e) {
        return url; // Fallback for invalid URLs
    }
};

const randomNameGenerator = () => {
    // Word lists
    const adjectives = [
        "happy", "bold", "brave", "cool", "eager", "fierce", "gentle",
        "jolly", "keen", "lucky", "mighty", "noble", "quirky", "swift",
        "vibrant", "witty", "zealous"
    ];
    
    const nouns = [
        "turing", "curie", "einstein", "hawking", "newton", "tesla",
        "lovelace", "hopper", "fermat", "feynman", "bohr", "galileo",
        "kepler", "gauss", "noether", "darwin"
    ];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const uniqueId = crypto.randomBytes(2).toString("hex"); // 4-char hex

    return `${adjective}-${noun}-${uniqueId}`;
};

/**
 * Build a Date from any tweet-ish input or return null if unknown.
 * Accepts:
 *  - A Date
 *  - ISO string or epoch (seconds/ms)
 *  - A tweet/meta object with: date, date_epoch, created_timestamp, tweet.created_at
 */
function coerceTweetDate(input) {
    if (!input) return null;

    if (input instanceof Date) {
        return Number.isNaN(input.getTime()) ? null : input;
    }

    if (typeof input === 'number' || typeof input === 'string') {
        const ms = coerceEpochOrIsoToMs(input);
        return ms == null ? null : new Date(ms);
    }

    // Assume object with possible fields
    const candidates = [
        input.date,                 // VX: "Fri Sep 12 00:25:15 +0000 2025"
        input.date_epoch,           // VX: 1757636715 (seconds)
        input.created_timestamp,    // FX: seconds or ms
        input.tweet?.created_at,    // some variants
        input.created_at,           // just in case
    ];

    for (const c of candidates) {
        const ms = coerceEpochOrIsoToMs(c);
        if (ms != null) {
            const dt = new Date(ms);
            if (!Number.isNaN(dt.getTime())) return dt;
        }
    }
    return null;
}

/**
 * Convert ISO string or epoch (seconds or ms) to milliseconds since epoch, or null.
 */
function coerceEpochOrIsoToMs(v) {
    if (v == null) return null;

    // Numeric or numeric-like string
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
    // Heuristic: < 1e12 → seconds; otherwise → milliseconds
        return n < 1e12 ? Math.trunc(n) * 1000 : Math.trunc(n);
    }

    // Non-numeric string → try Date.parse
    if (typeof v === 'string') {
        const t = Date.parse(v);
        return Number.isNaN(t) ? null : t;
    }

    return null;
}

/* -------------------------------------------------------------------------------------------------
 * OPTIONAL: media helpers you may already have; shown here for completeness.
 * If you already added collectMedia/filterMediaUrls previously, keep those implementations.
 ------------------------------------------------------------------------------------------------- */

// Example no-op stubs if not present; replace with your real implementations.
function collectMedia(meta) {
    const out = [];
    if (Array.isArray(meta?.media_extended)) {
        for (const m of meta.media_extended) {
            const url = m.url || m.thumbnail_url;
            if (!url) continue;
            out.push({
                type: m.type || (m.format ? 'video' : 'image'),
                url,
                thumbnail_url: m.thumbnail_url || url,
                width: m.size?.width ?? m.width ?? null,
                height: m.size?.height ?? m.height ?? null,
                format: m.format,
                duration_millis: m.duration_millis,
            });
        }
    }
    return out;
}
function filterMediaUrls(meta, { types = ['image', 'video'] } = {}) {
    const all = collectMedia(meta);
    return all.filter(m => types.includes(m.type));
}

module.exports = {
    formatTwitterDate,
    filterMediaUrls,
    getExtensionFromMediaUrl,
    removeTCOLink,
    stripQueryParams,
    randomNameGenerator,
    collectMedia,
};

