// features/twitter-post/canvas/metadata_normalize.js

const { collectMedia, formatTwitterDate, formatTwitterFooter } = require('../../twitter-core/utils.js');

// Robust text extraction (some FX payloads omit `text` but still have tweet.created_at or other props)
function getBestText(p) {
    return p?.text ?? p?.full_text ?? p?.tweet?.text ?? '';
}

function stripTrailingTco(s) {
    return (s || '').replace(/\s+https?:\/\/t\.co\/\w+$/i, '');
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

        description: stripTrailingTco(getBestText(metadataJson)),

        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: media,
        communityNote: stripTrailingTco(metadataJson.communityNote || ''),
    };

    metadata._displayDate = formatTwitterDate(metadataJson, { label: 'canvas.metaJson→displayDate' });
    metadata._displayDateFooter = formatTwitterFooter(metadata, { label: 'canvas.pre/footer' });

    return { metadata, media, images, videos };
}

function normalizeQtMetadata(qtJson) {
    if (!qtJson) return null;

    const qtMedia = Array.isArray(collectMedia?.(qtJson)) ? collectMedia(qtJson) : [];
    const qtFirst = qtMedia.length ? qtMedia[0] : null;

    // First QT item thumbnail (works for image or video)
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

        description: stripTrailingTco(qtJson.text || ''),
        mediaUrls: qtMedia.map(m => m.thumbnail_url || m.url).filter(Boolean),
        mediaExtended: qtMedia,
        ...(qtJson.error && { ...qtJson }),
    };

    qtMetadata._displayDate = formatTwitterDate(qtJson, { label: 'canvas.qt→displayDate' });
    qtMetadata._displayDateFooter = formatTwitterFooter(qtMetadata, { label: 'canvas.qt/footer' });

    return { qtMetadata, qtMedia, qtFirst, qtFirstThumbUrl };
}

module.exports = {
    normalizeMainMetadata,
    normalizeQtMetadata,
    getBestText, // exported only if you want it elsewhere
};
