/* eslint-disable no-empty */
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

/**
 * Normalize FX/VX payload media into a single array.
 * Handles images, videos, and card/OG "article" images.
 *
 * Output shape (per item):
 * {
 *   type: 'image' | 'video',
 *   url: string,                 // media URL
 *   thumbnail_url?: string,      // preview/thumbnail (video & sometimes images)
 *   size?: { width:number, height:number },
 *   width?: number,
 *   height?: number,
 * }
 */
function collectMedia(payload) {
    if (!payload || typeof payload !== 'object') return [];

    const out = [];
    const seen = new Set();

    const push = (item) => {
        if (!item || !item.url) return;
        const key = `${item.type}:${item.url}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(item);
    };

    // --- 1) Preferred: media_extended from FX/VX
    if (Array.isArray(payload.media_extended)) {
        for (const m of payload.media_extended) {
            const type = (m?.type || '').toLowerCase();
            const size = (m?.size && typeof m.size === 'object') ? {
                width: Number(m.size.width) || undefined,
                height: Number(m.size.height) || undefined,
            } : undefined;

            if (type === 'image') {
                push({
                    type: 'image',
                    url: m.url || m.thumbnail_url || null,
                    thumbnail_url: m.thumbnail_url || m.url || null,
                    size,
                    width: size?.width,
                    height: size?.height,
                });
            } else if (type === 'video' || type === 'gif') {
                push({
                    type: 'video',
                    url: m.url || m.video_url || null,
                    thumbnail_url: m.thumbnail_url || null,
                    size,
                    width: size?.width,
                    height: size?.height,
                });
            }
        }
    }

    // --- 2) mediaURLs fallback (heuristic by extension)
    if (Array.isArray(payload.mediaURLs)) {
        for (const u of payload.mediaURLs) {
            if (typeof u !== 'string') continue;
            const lower = u.toLowerCase();
            const isImg = /\.(jpe?g|png|webp)(\?|#|$)/i.test(lower);
            const isVid = /\.(mp4|mov|m4v)(\?|#|$)/i.test(lower);

            if (isImg) {
                push({
                    type: 'image',
                    url: u,
                    thumbnail_url: u,
                    // Unknown size; let renderer/load compute/crop
                    size: undefined,
                });
            } else if (isVid) {
                push({
                    type: 'video',
                    url: u,
                    thumbnail_url: null,
                    size: undefined,
                });
            }
        }
    }

    // --- 3) Link-preview / card image (FX/VX exposes as `article`)
    // Many “no media” tweets still have a large preview image here.
    // Guess a common OG size to reserve space (1200x630).
    if (payload.article && typeof payload.article === 'object') {
        const img = payload.article.image || payload.article.image_url || null;
        if (img && typeof img === 'string') {
            push({
                type: 'image',
                url: img,
                thumbnail_url: img,
                size: { width: 1200, height: 630 },
                width: 1200,
                height: 630,
            });
        }
    }

    // --- 4) Combined multi-image render (rare but supported by VX)
    // Treat as a single static image.
    if (payload.combinedMediaUrl && typeof payload.combinedMediaUrl === 'string') {
        push({
            type: 'image',
            url: payload.combinedMediaUrl,
            thumbnail_url: payload.combinedMediaUrl,
            // no reliable size; provide a square-ish fallback
            size: { width: 1200, height: 1200 },
            width: 1200,
            height: 1200,
        });
    }

    return out;
}

/**
 * Back-compat filter. Accepts either:
 *  - array of types: ['image','video']
 *  - array of extensions: ['jpg','jpeg','png','mp4']  (heuristic by extension length)
 *  - object: { types: [...] }
 */
function filterMediaUrls(meta, typesOrExts = ['image', 'video']) {
    const all = collectMedia(meta);

    // If it looks like an extensions array (e.g., ['jpg','png','mp4'])
    if (Array.isArray(typesOrExts) && typesOrExts.length && typeof typesOrExts[0] === 'string' && typesOrExts[0].length <= 5) {
        const exts = new Set(typesOrExts.map(s => s.toLowerCase()));
        return all.filter(m => {
            const u = m.url || '';
            const match = u.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
            const ext = match ? match[1].toLowerCase() : '';
            return exts.has(ext);
        });
    }

    // Otherwise treat as types filter
    const types = Array.isArray(typesOrExts) ? typesOrExts : (typesOrExts?.types || ['image', 'video']);
    const typeSet = new Set(types);
    return all.filter(m => typeSet.has(m.type));
}


const TZ_DEFAULT = process.env.TWITTER_TS_TZ || 'America/New_York';
const TZ_LABEL_DEFAULT = process.env.TWITTER_TS_LABEL || 'Eastern';
const DOT = '·';

/**
 * Format a tweet-ish object into:
 *   "3:58 PM Eastern · Sep 10, 2025"
 *
 * Uses env overrides:
 *   TWITTER_TS_TZ    (default: America/New_York)
 *   TWITTER_TS_LABEL (default: Eastern)
 */
function formatTwitterFooter(input, opts = {}) {
    const {
        locale = 'en-US',
        timeZone = TZ_DEFAULT,
        tzLabel = TZ_LABEL_DEFAULT,
        label = 'footer',
    } = opts;

    const dt = coerceTweetDate(input, label);
    if (!dt) return '';

    let time = '';
    let date = '';
    try {
        time = dt.toLocaleString(locale, {
            timeZone,
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {}

    try {
        date = dt.toLocaleString(locale, {
            timeZone,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {}

    if (!time && !date) return '';
    if (time && date) return `${time} ${tzLabel} ${DOT} ${date}`;
    return time || date;
}

module.exports = {
    formatTwitterDate,
    filterMediaUrls,
    getExtensionFromMediaUrl,
    removeTCOLink,
    stripQueryParams,
    randomNameGenerator,
    collectMedia,
    formatTwitterFooter,
};

