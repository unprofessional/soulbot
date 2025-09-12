/* eslint-disable no-empty */
// features/twitter-post/twitter_canvas.js

const { registerFont, createCanvas, loadImage } = require('canvas');
const { renderImageGallery } = require('./image_gallery_rendering.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');
const {
    getWrappedText,
    drawBasicElements,
    drawDesktopLayout,
    drawQtBasicElements,
    drawQtDesktopLayout,
    drawQtMissingStatus,
    getYPosFromLineHeight,
} = require('../twitter-core/canvas_utils.js');
const { collectMedia } = require('../twitter-core/utils.js');
const { formatTwitterDate } = require('../twitter-core/utils.js');


const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK'],
];

function registerFonts(baseFontUrl = '/usr/share/fonts') {
    FONT_PATHS.forEach(([path, family]) =>
        registerFont(`${baseFontUrl}${path}`, { family })
    );
}

function getMaxHeight(numImgs) {
    // 1=800, 2=600, 3/4=530, default 600
    return [0, 800, 600, 530, 530][numImgs] || 600;
}

/**
 * Calculate the total height needed for the quote-tweet rounded box.
 * IMPORTANT: All geometry *must* match drawQtBasicElements to avoid overflow/extra space.
 */
function calculateQuoteHeight(ctx, qtMetadata) {
    const DEBUG = process.env.DEBUG_QT === '1';
    const TAG = '[qt/calcHeight]';

    try {
        const lineHeight = 30;
        const bottomPadding = 30;
        const HEADER = 100;        // names/handle block before the first text line
        const MARGIN_BOTTOM = 8;   // inner margin above rounded bottom (must match draw)

        const qtMedia = Array.isArray(collectMedia?.(qtMetadata)) ? collectMedia(qtMetadata) : [];
        const hasMedia = qtMedia.length > 0;
        const expanded = Boolean(qtMetadata._expandMediaHint);
        const text = qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');

        // Font used for measuring (keep in sync with drawDescription)
        ctx.font = '24px "Noto Color Emoji"';

        // --- Compute wrap width from the SAME geometry the draw path uses ---
        const qtX = 20;                     // quote box left
        const boxW = 560;                   // quote box width
        const innerPad = 20;                // inner padding used by draw
        const innerLeft = qtX + innerPad;   // 40
        const innerRight = qtX + boxW - innerPad; // 560

        // drawQtBasicElements: textX = expanded ? innerLeft : (hasMedia ? 230 : 100)
        const textX = expanded ? innerLeft : (hasMedia ? 230 : 100);
        const wrapWidth = Math.max(1, innerRight - textX); // 520 (expanded), 330 (with media), 460 (no media)

        const lines = getWrappedText(ctx, text, wrapWidth);
        const descHeight = lines.length * lineHeight;

        if (DEBUG) {
            console.debug(`${TAG} ───────────────────────────────────────────`);
            console.debug(`${TAG} flags: expanded=${expanded} hasMedia=${hasMedia}`);
            console.debug(`${TAG} geom: innerLeft=${innerLeft} innerRight=${innerRight} textX=${textX} wrapWidth=${wrapWidth}`);
            console.debug(`${TAG} text: lines=${lines.length} lineHeight=${lineHeight} descHeight=${descHeight}`);
        }

        if (expanded && qtMetadata._expandedMediaHeight) {
            const total =
        HEADER + descHeight + 20 /*gap*/ +
        qtMetadata._expandedMediaHeight +
        bottomPadding + MARGIN_BOTTOM;

            DEBUG && console.debug(
                `${TAG} [expanded] parts: HEADER=${HEADER} desc=${descHeight} gap=20 media=${qtMetadata._expandedMediaHeight} bottomPad=${bottomPadding} marginBottom=${MARGIN_BOTTOM} => total=${total}`
            );
            DEBUG && console.debug(`${TAG} ───────────────────────────────────────────`);
            return total;
        }

        // Compact layout (with or without media)
        const COMPACT_MIN_WITH_MEDIA = 285; // <- matches drawQtBasicElements' 285
        const textBlock = HEADER + descHeight + bottomPadding + MARGIN_BOTTOM;
        const total = hasMedia ? Math.max(textBlock, COMPACT_MIN_WITH_MEDIA) : textBlock;

        DEBUG && console.debug(
            `${TAG} [compact] textBlock=${textBlock} minWithMedia=${COMPACT_MIN_WITH_MEDIA} hasMedia=${hasMedia} => total=${total}`
        );
        DEBUG && console.debug(`${TAG} ───────────────────────────────────────────`);
        return total;
    } catch (e) {
        console.warn('[qt/calcHeight] ERROR (fallback to 205):', e);
        return 205;
    }
}

async function safeLoadImage(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return undefined;
    try {
        return await loadImage(url);
    } catch {
        return undefined;
    }
}

async function createTwitterCanvas(metadataJson, isImage) {
    registerFonts();
    const font = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

    const maxWidth = 600;
    const canvas = createCanvas(maxWidth, 650);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textDrawingMode = 'glyph';

    const log = (...args) => { try { console.debug('[twitter_canvas]', ...args); } catch {} };

    // --- Normalize incoming metadata (names kept for downstream compatibility) ---
    console.debug('[date] canvas.input', {
        date: metadataJson?.date,
        date_epoch: metadataJson?.date_epoch,
        created_timestamp: metadataJson?.created_timestamp,
        created_at: metadataJson?.created_at,
        tweet_created_at: metadataJson?.tweet?.created_at,
    });

    // Normalize media from FX/VX into a single shape
    const media = Array.isArray(collectMedia?.(metadataJson)) ? collectMedia(metadataJson) : [];
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,

        // include all known date fields so formatTwitterDate(metadata) can succeed
        date: metadataJson.date ?? null,                    // VX string (e.g., "Fri Sep 12 00:25:15 +0000 2025")
        date_epoch: metadataJson.date_epoch ?? null,        // VX seconds
        created_timestamp: metadataJson.created_timestamp ?? null, // FX seconds/ms
        created_at: metadataJson.created_at ?? null,        // some variants

        description: (metadataJson.text || '').replace(/\s+https?:\/\/t\.co\/\w+$/i, ''), // strip trailing t.co
        mediaUrls: metadataJson.mediaURLs,                 // optional legacy
        mediaExtended: media,                              // <- use normalized media
        communityNote: (metadataJson.communityNote || '').replace(/\s+https?:\/\/t\.co\/\w+$/i, ''),
    };

    // Precompute display date from the full payload (most robust)
    metadata._displayDate = formatTwitterDate(metadataJson, { label: 'canvas.metaJson→displayDate' });
    console.debug('[date] canvas.meta', {
        from_meta: { date: metadata.date, date_epoch: metadata.date_epoch, created_timestamp: metadata.created_timestamp },
        _displayDate: metadata._displayDate,
    });

    // --- Quoted tweet normalization (if present) ---
    const qt = metadataJson.qtMetadata || null;
    const qtMedia = qt ? (Array.isArray(collectMedia?.(qt)) ? collectMedia(qt) : []) : [];
    const qtImages = qtMedia.filter(m => m.type === 'image');
    const qtVideos = qtMedia.filter(m => m.type === 'video');

    const qtMetadata = qt
        ? {
            authorNick: qt.user_screen_name || '',
            authorUsername: qt.user_name || '',
            pfpUrl: qt.user_profile_image_url || '',

            // carry all known date fields so formatTwitterDate(qtMetadata) works
            date: qt.date ?? null,
            date_epoch: qt.date_epoch ?? null,
            created_timestamp: qt.created_timestamp ?? null,
            created_at: qt.created_at ?? null,

            description: (qt.text || '').replace(/\s+https?:\/\/t\.co\/\w+$/i, ''),
            mediaUrls: qtImages.map(i => i.url).filter(Boolean),
            mediaExtended: qtMedia,
            ...(qt.error && { ...qt }),
        }
        : null;

    if (qtMetadata) {
        qtMetadata._displayDate = formatTwitterDate(qt, { label: 'canvas.qt→displayDate' });
        console.debug('[date] canvas.qt.meta', {
            from_qt: {
                date: qtMetadata.date,
                date_epoch: qtMetadata.date_epoch,
                created_timestamp: qtMetadata.created_timestamp,
            },
            _displayDate: qtMetadata._displayDate,
        });
    }

    // ---- Main media metrics ----
    const numImgs = images.length;
    const numVids = videos.length;
    const hasImgs = numImgs > 0;
    const hasVids = numVids > 0;
    const onlyVids = hasVids && !hasImgs;

    const mediaMaxHeight = getMaxHeight(numImgs);
    let heightShim = 0;

    let mediaObj = { height: 0, width: 0 };
    if (hasImgs) {
        const first = images[0];
        const size = first?.width && first?.height
            ? { width: first.width, height: first.height }
            : first?.size || null;

        if (size) {
            mediaObj = scaleDownToFitAspectRatio(size, mediaMaxHeight, 560);
            heightShim =
        (images.length < 2 && mediaObj.width > mediaObj.height)
            ? mediaObj.height * (560 / mediaObj.width)
            : Math.min(mediaObj.height, mediaMaxHeight);
        }
    }

    // --- Main text wrapping ---
    const MAX_DESC_CHARS = 1000;
    const MAX_QT_DESC_CHARS = 500;

    if ((metadata.description?.length ?? 0) > MAX_DESC_CHARS + 50) {
        metadata.description = metadata.description.slice(0, MAX_DESC_CHARS) + '…';
    }

    const maxCharLength = onlyVids ? 120 : 240; // rough char-based width for main tweet
    const descLines = getWrappedText(ctx, metadata.description || '', maxCharLength);
    const baseY = 110;
    const descHeight = descLines.length * 30 + baseY + 40 + heightShim;

    log('main', {
        numImgs, numVids, hasImgs, hasVids, onlyVids,
        mediaMaxHeight, mediaObj, heightShim,
        textLen: (metadata.description || '').length,
        descLines: descLines.length,
        descHeight, baseY,
    });

    // --- Quote tweet sizing (supports "expanded" media when main has no media) ---
    let qtHeight = 0;
    let expandQtMedia = false;
    let qtExpandedMediaSize = null;

    if (qtMetadata) {
        if ((qtMetadata.description?.length ?? 0) > MAX_QT_DESC_CHARS + 50) {
            qtMetadata.description = qtMetadata.description.slice(0, MAX_QT_DESC_CHARS) + '…';
        }

        const qtHasImgs = qtImages.length > 0;
        const qtHasVids = qtVideos.length > 0;

        // Expand quoted image to large/full preview if the main post has no media
        expandQtMedia = (!hasImgs && !hasVids) && qtHasImgs && !qtHasVids;

        if (expandQtMedia) {
            const first = qtImages[0];
            const size = first?.width && first?.height
                ? { width: first.width, height: first.height }
                : first?.size || null;

            if (size) {
                // near full width inside the quote box
                qtExpandedMediaSize = scaleDownToFitAspectRatio(size, /* maxH */ 420, /* maxW */ 520);
                qtMetadata._expandMediaHint = true;
                qtMetadata._expandedMediaHeight = qtExpandedMediaSize.height;
            }
        }

        log('qt:pre', {
            exists: true,
            qtHasImgs, qtHasVids,
            expandQtMedia,
            firstSize: qtImages[0] ? { width: qtImages[0].width, height: qtImages[0].height } : null,
            qtExpandedMediaSize,
        });

        // NOTE: no post-padding; calc is authoritative. Only adjust for error box.
        qtHeight = calculateQuoteHeight(ctx, qtMetadata) - (qtMetadata.error ? 40 : 0);

        log('qt:post', { qtHeight });
    } else {
        log('qt:none');
    }

    const totalHeight = descHeight + qtHeight;
    canvas.height = totalHeight;
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    log('canvas', { maxWidth, totalHeight });

    const [favicon, pfp] = await Promise.all([
        safeLoadImage('https://abs.twimg.com/favicons/twitter.3.ico'),
        safeLoadImage(metadata.pfpUrl),
    ]);
    log('assets', { faviconLoaded: Boolean(favicon), pfpLoaded: Boolean(pfp) });

    const useDesktopLayout = false;

    if (useDesktopLayout) {
        drawDesktopLayout(ctx, font, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight,
        });
    } else {
        drawBasicElements(ctx, font, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight,
        });
    }

    if (qtMetadata) {
        const qtPfp = await safeLoadImage(qtMetadata.pfpUrl);
        const hasQtMedia = qtImages.length > 0 || qtVideos.length > 0;
        const qtMediaUrl = hasQtMedia
            ? (qtImages[0]?.thumbnail_url || qtImages[0]?.url || null)
            : null;
        const qtMediaImg = qtMediaUrl ? await safeLoadImage(qtMediaUrl) : undefined;

        const qtUseDesktopLayout = false;

        log('qt:draw', {
            qtUseDesktopLayout,
            canvasHeightOffset: descHeight,
            qtCanvasHeightOffset: qtHeight,
            expandQtMedia,
            expandedMediaSize: qtExpandedMediaSize,
            qtPfpLoaded: Boolean(qtPfp),
            qtMediaImgLoaded: Boolean(qtMediaImg),
        });

        if (qtUseDesktopLayout) {
            drawQtDesktopLayout(ctx, font, qtMetadata, qtPfp, qtMediaImg, {
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtHeight,
                expandQtMedia,
                expandedMediaSize: expandQtMedia ? qtExpandedMediaSize : null,
            });
        } else {
            drawQtBasicElements(ctx, font, qtMetadata, qtPfp, qtMediaImg, {
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtHeight,
                hasImgs,
                hasVids,
                expandQtMedia,
                expandedMediaSize: qtExpandedMediaSize,
            });
        }
    }

    // Optional: draw gallery thumbnails for main tweet
    const firstThumbUrl = images[0]?.thumbnail_url || images[0]?.url || null;
    const extMatch = firstThumbUrl ? firstThumbUrl.match(/\.(jpe?g|png)(\?|#|$)/i) : null;
    const ext = extMatch ? extMatch[1].toLowerCase() : null;
    const allowedExts = ['jpg', 'jpeg', 'png'];

    if (ext && allowedExts.includes(ext)) {
        log('gallery', {
            ext,
            atY: getYPosFromLineHeight(descLines, baseY),
            heightShim,
            mediaMaxHeight,
        });
        await renderImageGallery(
            ctx,
            metadata,
            descHeight,
            heightShim,
            mediaMaxHeight,
            560,
            getYPosFromLineHeight(descLines, baseY)
        );
    }

    return isImage ? canvas.toBuffer('image/png') : canvas.toBuffer();
}

module.exports = { createTwitterCanvas };
