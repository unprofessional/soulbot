// features/twitter-core/extract_media.js

const { fetchMetadata, toFixupx } = require('./fetch_metadata.js');
const { collectMedia, formatTwitterDate, stripQueryParams } = require('./utils.js');
const { getSourceText, normalizeWhitespace } = require('./translation_service.js');

const EXPLODE_TWEET_MAX_DESC_CHARS = 1500;

const STATUS_URL_RE = /https?:\/\/(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+\/status\/\d+(?:\?[^\s>]*)?/i;
const MEDIA_FETCH_HEADERS = {
    'User-Agent': 'SOULbot/1.0',
    'Accept': '*/*',
};

function extractStatusUrl(input) {
    if (typeof input !== 'string') return null;
    const match = input.match(STATUS_URL_RE);
    if (!match) return null;
    return stripQueryParams(match[0]);
}

function inferExtension(url, contentType, mediaType) {
    const pathname = (() => {
        try {
            return new URL(url).pathname.toLowerCase();
        } catch {
            return String(url || '').toLowerCase();
        }
    })();

    if (/\.(jpe?g)(?:$|\?)/i.test(pathname)) return 'jpg';
    if (/\.png(?:$|\?)/i.test(pathname)) return 'png';
    if (/\.webp(?:$|\?)/i.test(pathname)) return 'webp';
    if (/\.gif(?:$|\?)/i.test(pathname)) return 'gif';
    if (/\.mp4(?:$|\?)/i.test(pathname)) return 'mp4';
    if (/\.mov(?:$|\?)/i.test(pathname)) return 'mov';
    if (/\.m4v(?:$|\?)/i.test(pathname)) return 'm4v';

    const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (normalizedType === 'image/jpeg') return 'jpg';
    if (normalizedType === 'image/png') return 'png';
    if (normalizedType === 'image/webp') return 'webp';
    if (normalizedType === 'image/gif') return 'gif';
    if (normalizedType === 'video/mp4') return 'mp4';
    if (normalizedType === 'video/quicktime') return 'mov';

    return mediaType === 'video' ? 'mp4' : 'jpg';
}

async function downloadMediaFile(media, index) {
    const response = await fetch(media.url, {
        headers: MEDIA_FETCH_HEADERS,
    });

    if (!response.ok) {
        throw new Error(`Media download failed with ${response.status} for ${media.url}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const extension = inferExtension(media.url, contentType, media.type);
    const arrayBuffer = await response.arrayBuffer();

    return {
        attachment: Buffer.from(arrayBuffer),
        name: `tweet-media-${index + 1}.${extension}`,
    };
}

function stripTrailingTco(text) {
    return String(text || '')
        .replace(/(?:^|\s)https?:\/\/t\.co\/[^\s]+[\s]*$/i, '')
        .trimEnd();
}

function truncateText(text, maxChars = EXPLODE_TWEET_MAX_DESC_CHARS) {
    const normalized = normalizeWhitespace(text);
    if (!normalized || normalized.length <= maxChars) return normalized;
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function buildMessageContent(meta, statusUrl) {
    const lines = [`<${statusUrl}>`];
    const originalText = truncateText(
        stripTrailingTco(getSourceText(meta)),
        EXPLODE_TWEET_MAX_DESC_CHARS
    );
    const displayDate = formatTwitterDate(meta, { label: 'extract-media/contentDate' });

    if (originalText) lines.push(originalText);
    if (displayDate) lines.push(displayDate);

    return lines.join('\n\n');
}

async function extractMediaFromTweetUrl(rawInput, log = console.log) {
    const statusUrl = extractStatusUrl(rawInput);
    if (!statusUrl) {
        return {
            ok: false,
            message: 'Please provide a valid Twitter/X post URL.',
        };
    }

    const isXDotCom = /^https?:\/\/x\.com\//i.test(statusUrl);
    const meta = await fetchMetadata(statusUrl, null, isXDotCom, log);

    if (!meta || meta.error) {
        return {
            ok: false,
            message: meta?.message || 'Could not fetch that post.',
            fallbackLink: meta?.fallback_link || toFixupx(statusUrl),
        };
    }

    const media = collectMedia(meta);
    const files = media.length
        ? await Promise.all(media.map((item, index) => downloadMediaFile(item, index)))
        : [];

    return {
        ok: true,
        files,
        content: buildMessageContent(meta, statusUrl),
        statusUrl,
        fallbackLink: toFixupx(statusUrl),
    };
}

module.exports = {
    extractMediaFromTweetUrl,
    extractStatusUrl,
};
