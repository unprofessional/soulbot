// features/twitter-core/utils.js

const crypto = require("crypto");

const DATE_DEBUG = process.env.DEBUG_DATES === '1';
function dateLog(...args) { if (DATE_DEBUG) console.debug('[date]', ...args); }

/**
 * Safe, locale-aware formatter.
 * You can pass:
 *  - The full tweet/meta object (recommended)
 *  - A Date
 *  - An ISO/epoch value
 * Returns '' if not parseable.
 * @param {*} input
 * @param {{locale?:string,timeZone?:string,label?:string}} [opts]
 */
function formatTwitterDate(input, opts = {}) {
    const { locale = 'en-US', timeZone, label = 'format' } = opts;
    const dt = coerceTweetDate(input, label);
    if (!dt) { dateLog('format: no date', { label }); return ''; }

    try {
        const s = dt.toLocaleString(locale, {
            timeZone,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
        dateLog('format: OK', { label, out: s });
        return s;
    } catch (e) {
        const iso = dt.toISOString();
        dateLog('format: toLocaleString threw, fallback ISO', { label, iso, err: String(e) });
        return iso;
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
 *  - A tweet/meta object with: date, date_epoch, created_timestamp, tweet.created_at, created_at
 */
function coerceTweetDate(input, label = 'input') {
    if (!input) { dateLog('coerceTweetDate: empty', { label }); return null; }

    if (input instanceof Date) {
        dateLog('coerceTweetDate: got Date', { label, iso: input.toISOString() });
        return Number.isNaN(input.getTime()) ? null : input;
    }

    if (typeof input === 'number' || typeof input === 'string') {
        const ms = coerceEpochOrIsoToMs(input, `${label}:primitive`);
        const dt = ms == null ? null : new Date(ms);
        dateLog('coerceTweetDate: primitive →', { ms, iso: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null });
        return dt && !Number.isNaN(dt.getTime()) ? dt : null;
    }

    // Assume object with possible fields
    const candidates = [
        { k: 'date',               v: input.date },
        { k: 'date_epoch',         v: input.date_epoch },
        { k: 'created_timestamp',  v: input.created_timestamp },
        { k: 'tweet.created_at',   v: input.tweet?.created_at },
        { k: 'created_at',         v: input.created_at },
    ];

    dateLog('coerceTweetDate: candidates', Object.fromEntries(candidates.map(c => [c.k, c.v])));
    for (const c of candidates) {
        const ms = coerceEpochOrIsoToMs(c.v, `${label}:${c.k}`);
        if (ms != null) {
            const dt = new Date(ms);
            if (!Number.isNaN(dt.getTime())) {
                dateLog('coerceTweetDate: chose', { key: c.k, ms, iso: dt.toISOString() });
                return dt;
            }
        }
    }

    dateLog('coerceTweetDate: none matched', { label });
    return null;
}

/**
 * Convert ISO string or epoch (seconds or ms) to milliseconds since epoch, or null.
 * @param {string|number|null|undefined} v
 * @param {string} [label] - for debug logs
 */
function coerceEpochOrIsoToMs(v, label = 'value') {
    if (v == null) {
        dateLog('coerce: null/undefined', { label });
        return null;
    }

    // Numeric or numeric-like string?
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
        const ms = n < 1e12 ? Math.trunc(n) * 1000 : Math.trunc(n);
        dateLog('coerce: numeric', { label, input: String(v).slice(0, 40), seconds: n < 1e12, ms });
        return ms;
    }

    // Non-numeric string → try Date.parse
    if (typeof v === 'string') {
        const t = Date.parse(v);
        dateLog('coerce: string', { label, input: v.slice(0, 80), parsed: t, ok: !Number.isNaN(t) });
        return Number.isNaN(t) ? null : t;
    }

    dateLog('coerce: unsupported type', { label, type: typeof v });
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

