// features/twitter-core/utils.js

const crypto = require("crypto");

/**
 * Format a tweet-ish date safely.
 * You can pass the whole tweet/meta object, a Date, or a raw ISO/epoch.
 * Returns '' (empty string) if the date is not parseable.
 */
function formatTwitterDate(input, {
    locale = 'en-US',
    timeZone, // let Node decide; set to 'UTC' if you want UTC display
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
    // Fallback: ISO without throwing
        return dt.toISOString();
    }
}

// Find number of associated media
function filterMediaUrls(meta, { types = ['image', 'video'] } = {}) {
    const all = collectMedia(meta);
    return all.filter(m => types.includes(m.type));
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

// NEW helper: collectMedia(meta) + safe filterMediaUrls(meta)

function collectMedia(meta) {
    // Accept both shapes:
    // - Your new normalizer: meta.media_extended: [{ type, url, thumbnail_url, size:{width,height}, ... }]
    // - Older shapes: meta.media, meta.photos, meta.videos, etc.
    const out = [];

    // Preferred, normalized shape
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

    // Legacy fallbacks (if any upstream code still sets these)
    if (Array.isArray(meta?.photos)) {
        for (const p of meta.photos) {
            if (!p?.url) continue;
            out.push({ type: 'image', url: p.url, thumbnail_url: p.url, width: p.width ?? null, height: p.height ?? null });
        }
    }
    if (Array.isArray(meta?.videos)) {
        for (const v of meta.videos) {
            if (!v?.url) continue;
            out.push({
                type: 'video',
                url: v.url,
                thumbnail_url: v.thumbnail_url || null,
                width: v.width ?? null,
                height: v.height ?? null,
                format: v.format,
                duration_millis: typeof v.duration === 'number' ? Math.round(v.duration * 1000) : v.duration_millis,
            });
        }
    }

    return out;
}

/**
 * Coerce a tweet-ish object into a valid Date, or null if unknown.
 * Accepts:
 *  - obj.date (ISO or epoch as string/number)
 *  - obj.date_epoch (seconds or ms)
 *  - obj.created_timestamp (seconds or ms, FX)
 *  - obj.tweet?.created_at (ISO)
 */
function coerceTweetDate(input) {
    if (!input) return null;

    // If a Date was passed directly
    if (input instanceof Date) {
        return Number.isNaN(input.getTime()) ? null : input;
    }

    // If a primitive was passed (number/string)
    if (typeof input === 'number' || typeof input === 'string') {
        const ms = coerceEpochOrIsoToMs(input);
        return ms == null ? null : new Date(ms);
    }

    // Otherwise assume it's a tweet/meta object
    const candidates = [
        input.date,
        input.created_at,
        input.tweet?.created_at,
        input.date_epoch,
        input.created_timestamp,
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

/** Helper: convert ISO / epoch (s or ms) → milliseconds, or null */
function coerceEpochOrIsoToMs(v) {
    if (v == null) return null;

    // Numeric-ish string or number
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
    // Heuristic: < 1e12 → seconds; otherwise ms
        return n < 1e12 ? Math.trunc(n) * 1000 : Math.trunc(n);
    }

    // Non-numeric string → try Date.parse
    if (typeof v === 'string') {
        const t = Date.parse(v);
        return Number.isNaN(t) ? null : t;
    }

    return null;
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

