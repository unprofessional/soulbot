// features/twitter-post/canvas/metadata_normalize.js

const { collectMedia, formatTwitterDate, formatTwitterFooter } = require('../../twitter-core/utils.js');
const { buildDisplayText } = require('../../twitter-core/translation_service.js');

function getBestText(p) {
    return p?.text ?? p?.full_text ?? p?.tweet?.text ?? '';
}

function stripTrailingTco(s) {
    const str = String(s || '');

    // Remove a trailing t.co link even if:
    // - there is no leading whitespace (tweet is ONLY the link)
    // - there are trailing spaces/newlines
    // - the short code contains non-\w chars (t.co can include mixed case; be permissive)
    //
    // Examples handled:
    // "https://t.co/AbC123"
    // "text https://t.co/AbC123"
    // "https://t.co/AbC123\n"
    // "https://t.co/AbC123  "
    return str.replace(/(?:^|\s)https?:\/\/t\.co\/[^\s]+[\s]*$/i, '').trimEnd();
}

function getEpochMs(obj) {
    // Prefer epoch-like fields if present
    const epochSec =
        (Number.isFinite(obj?.date_epoch) ? obj.date_epoch : null) ??
        (Number.isFinite(obj?.created_timestamp) ? obj.created_timestamp : null);

    if (Number.isFinite(epochSec)) {
        // Heuristic: if it's already ms, keep it
        return epochSec > 10_000_000_000 ? epochSec : epochSec * 1000;
    }

    // Fall back to ISO-ish strings
    const s = obj?.created_at ?? obj?.date ?? null;
    if (!s) return null;

    const ms = Date.parse(String(s));
    return Number.isFinite(ms) ? ms : null;
}

function formatReplyDelta(qtMeta, mainMeta) {
    const qtMs = getEpochMs(qtMeta);
    const mainMs = getEpochMs(mainMeta);
    if (!Number.isFinite(qtMs) || !Number.isFinite(mainMs)) return null;

    const diffMs = mainMs - qtMs;
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null;

    const diffSec = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSec / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1) return `${days}d later`;
    if (hours >= 1) return `${hours}h later`;
    if (mins >= 1) return `${mins}m later`;
    return `${diffSec}s later`;
}

function normalizeMainMetadata(metadataJson) {
    const media = Array.isArray(collectMedia?.(metadataJson)) ? collectMedia(metadataJson) : [];
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,

        date: metadataJson.date ?? null,
        date_epoch: metadataJson.date_epoch ?? null,
        created_timestamp: metadataJson.created_timestamp ?? null,
        created_at: metadataJson.created_at ?? null,

        description: stripTrailingTco(buildDisplayText({
            ...metadataJson,
            text: getBestText(metadataJson),
        })),

        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: media,
        communityNote: stripTrailingTco(metadataJson.communityNote || ''),
    };

    console.debug('[desc] normalized', {
        raw: getBestText(metadataJson),
        stripped: metadata.description,
        len: (metadata.description || '').length,
    });

    metadata._displayDate = formatTwitterDate(metadataJson, { label: 'canvas.metaJson→displayDate' });
    metadata._displayDateFooter = formatTwitterFooter(metadata, { label: 'canvas.pre/footer' });

    return { metadata, media, images, videos };
}

function normalizeQtMetadata(qtJson) {
    if (!qtJson) return null;

    const qtMedia = Array.isArray(collectMedia?.(qtJson)) ? collectMedia(qtJson) : [];
    const qtFirst = qtMedia.length ? qtMedia[0] : null;

    const qtFirstThumbUrl = qtFirst
        ? (qtFirst.thumbnail_url || (qtFirst.type === 'image' ? qtFirst.url : null))
        : null;

    const qtMetadata = {
        authorNick: qtJson.user_screen_name || '',
        authorUsername: qtJson.user_name || '',
        pfpUrl: qtJson.user_profile_image_url || '',

        date: qtJson.date ?? null,
        date_epoch: qtJson.date_epoch ?? null,
        created_timestamp: qtJson.created_timestamp ?? null,
        created_at: qtJson.created_at ?? null,

        description: stripTrailingTco(buildDisplayText({
            ...qtJson,
            text: getBestText(qtJson),
        })),
        mediaUrls: qtMedia.map(m => m.thumbnail_url || m.url).filter(Boolean),
        mediaExtended: qtMedia,
        communityNote: stripTrailingTco(qtJson.communityNote || ''),
        ...(qtJson.error && { ...qtJson }),
    };

    qtMetadata._displayDate = formatTwitterDate(qtJson, { label: 'canvas.qt→displayDate' });
    qtMetadata._displayDateFooter = formatTwitterFooter(qtMetadata, { label: 'canvas.qt/footer' });

    return { qtMetadata, qtMedia, qtFirst, qtFirstThumbUrl };
}

module.exports = {
    normalizeMainMetadata,
    normalizeQtMetadata,
    formatReplyDelta, // <-- new (used by twitter_canvas.js)
    getBestText,
};
