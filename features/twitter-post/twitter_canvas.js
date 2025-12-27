/* eslint-disable no-empty */
// features/twitter-post/twitter_canvas.js

const { createCanvas } = require('canvas');

const { renderImageGallery } = require('./image_gallery_rendering.js');

const {
    drawBasicElements,
    drawDesktopLayout,
    drawQtBasicElements,
    drawQtDesktopLayout,
} = require('../twitter-core/canvas_utils.js');

const { registerFonts } = require('./canvas/fonts.js');
const {
    MAX_WIDTH,
    INITIAL_HEIGHT,
    DEFAULT_BOTTOM_PAD_NO_QT,
    DEFAULT_BOTTOM_PAD_WITH_QT,
    MAX_DESC_CHARS,
    MAX_QT_DESC_CHARS,
    getMaxHeight,
    FOOTER_LINE_H,
    FOOTER_FONT_SIZE,
} = require('./canvas/constants.js');

const { debugRect } = require('./canvas/debug.js');
const { safeLoadImage } = require('./canvas/safe_load_image.js');
const { normalizeMainMetadata, normalizeQtMetadata } = require('./canvas/metadata_normalize.js');
const { measureMainLayout } = require('./canvas/main_layout.js');
const { computeQtSizing } = require('./canvas/qt_layout.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js'); // retained because you used it directly for main media sizing

async function createTwitterCanvas(metadataJson, isImage) {
    registerFonts();

    const fontChain = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

    const canvas = createCanvas(MAX_WIDTH, INITIAL_HEIGHT);
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

    const { metadata, images, videos } = normalizeMainMetadata(metadataJson);

    console.debug('[date] canvas.meta', {
        from_meta: { date: metadata.date, date_epoch: metadata.date_epoch, created_timestamp: metadata.created_timestamp },
        _displayDate: metadata._displayDate,
        _displayDateFooter: metadata._displayDateFooter,
    });

    // --- Quoted tweet normalization (if present) ---
    const qt = metadataJson.qtMetadata || null;
    const qtNorm = normalizeQtMetadata(qt);
    const qtMetadata = qtNorm?.qtMetadata || null;
    const qtMedia = qtNorm?.qtMedia || [];
    const qtFirst = qtNorm?.qtFirst || null;
    const qtFirstThumbUrl = qtNorm?.qtFirstThumbUrl || null;

    if (qtMetadata) {
        console.debug('[date] canvas.qt.meta', {
            from_qt: {
                date: qtMetadata.date,
                date_epoch: qtMetadata.date_epoch,
                created_timestamp: qtMetadata.created_timestamp,
            },
            _displayDate: qtMetadata._displayDate,
            _displayDateFooter: qtMetadata._displayDateFooter,
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

    // Legacy-ish size hints used by gallery renderer fallback paths
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

    /* ------------------------- Main layout measurement ------------------------- */
    // measureMainLayout will trim description to MAX_DESC_CHARS (kept in constants)
    const main = measureMainLayout(ctx, {
        metadata,
        images,
        hasImgs,
        hasVids,
        maxWidth: MAX_WIDTH,
        mediaMaxHeight,
    });

    const {
        descX,
        mainWrapWidth,
        descLines,
        baseY,
        textHeight,
        descBottomY,
        willDrawGallery,
        ext,
        mediaY,
        galleryH,
        footerBaselineY,
        bodyBottomY,
    } = main;

    // This is what downstream code uses as canvasHeightOffset / QT start
    const descHeight = bodyBottomY;

    console.debug('[canvas.body]', {
        descX,
        mainWrapWidth,
        lines: descLines.length,
        textHeight,
        baseY,
        descBottomY,
        willDrawGallery,
        mediaY,
        galleryH,
        footerBaselineY,
        bodyBottomY,
        heightShim,
        descHeight,
    });

    debugRect(ctx, descX, baseY - 30 + 6, mainWrapWidth, textHeight, `Main text (w=${mainWrapWidth})`);
    if (process.env.DEBUG_CANVAS_BOXES === '1' && willDrawGallery) {
        debugRect(ctx, 20, mediaY, 560, galleryH, `Gallery (h=${galleryH})`);
        debugRect(ctx, 30, footerBaselineY - FOOTER_FONT_SIZE, 540, FOOTER_LINE_H, 'Footer line box');
    }

    log('main', {
        numImgs, numVids, hasImgs, hasVids, onlyVids,
        mediaMaxHeight, mediaObj, heightShim,
        willDrawGallery,
        galleryH,
        textLen: (metadata.description || '').length,
        descLines: descLines.length,
        descHeight, baseY,
    });

    /* -------------------- Quote tweet sizing & expansion (final) ------------------- */
    let qtBoxHeight = 0;
    let expandQtMedia = false;
    let qtExpandedMediaSize = null;

    if (qtMetadata) {
        const qtSizing = computeQtSizing(ctx, {
            qtMetadata,
            qtMedia,
            qtFirst,
            hasImgs,
            hasVids,
            fontChain,
            maxQtDescChars: MAX_QT_DESC_CHARS,
        });

        qtBoxHeight = qtSizing.qtBoxHeight;
        expandQtMedia = qtSizing.expandQtMedia;
        qtExpandedMediaSize = qtSizing.qtExpandedMediaSize;

        log('qt:pre', {
            exists: true,
            qtHasAnyMedia: Array.isArray(qtMetadata.mediaExtended) && qtMetadata.mediaExtended.length > 0,
            qtContainsVideo: qtSizing.qtContainsVideo,
            expandQtMedia,
            firstType: qtFirst?.type || null,
            firstSize: qtFirst?.size || null,
            calcHeight: qtSizing.calcHeight,
            textNeed: qtSizing.textNeed,
            qtBoxHeight,
            qtExpandedMediaSize,
        });
    } else {
        log('qt:none');
    }

    /* ------------------------- Final canvas height & draw ------------------------- */
    const extraBottomPad = qtMetadata ? DEFAULT_BOTTOM_PAD_WITH_QT : DEFAULT_BOTTOM_PAD_NO_QT;
    const totalHeight = descHeight + qtBoxHeight + extraBottomPad;

    canvas.height = totalHeight;
    ctx.fillRect(0, 0, MAX_WIDTH, totalHeight);

    if (process.env.DEBUG_CANVAS_BOXES === '1') {
        ctx.save();
        ctx.strokeStyle = '#ff66aa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 0.5);
        ctx.lineTo(MAX_WIDTH, canvas.height - 0.5);
        ctx.stroke();
        ctx.restore();
    }

    log('canvas', { maxWidth: MAX_WIDTH, totalHeight });

    const [favicon, pfp] = await Promise.all([
        safeLoadImage('https://abs.twimg.com/favicons/twitter.3.ico'),
        safeLoadImage(metadata.pfpUrl),
    ]);
    log('assets', { faviconLoaded: Boolean(favicon), pfpLoaded: Boolean(pfp) });

    const useDesktopLayout = false;

    if (useDesktopLayout) {
        drawDesktopLayout(ctx, fontChain, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight,
            footerY: footerBaselineY,
        });
    } else {
        drawBasicElements(ctx, fontChain, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight,
            footerY: footerBaselineY,
        });
    }

    // --- Draw QT box (with thumb or expanded image) ---
    if (qtMetadata) {
        const qtPfp = await safeLoadImage(qtMetadata.pfpUrl);

        const qtMediaUrl = qtFirstThumbUrl || null;
        const qtMediaImg = qtMediaUrl ? await safeLoadImage(qtMediaUrl) : undefined;

        const qtUseDesktopLayout = false;

        log('qt:draw', {
            qtUseDesktopLayout,
            canvasHeightOffset: descHeight,
            qtCanvasHeightOffset: qtBoxHeight,
            expandQtMedia,
            expandedMediaSize: qtExpandedMediaSize,
            qtPfpLoaded: Boolean(qtPfp),
            qtMediaImgLoaded: Boolean(qtMediaImg),
            qtMediaUrl,
        });

        if (qtUseDesktopLayout) {
            drawQtDesktopLayout(ctx, fontChain, qtMetadata, qtPfp, qtMediaImg, {
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtBoxHeight,
                expandQtMedia,
                expandedMediaSize: expandQtMedia ? qtExpandedMediaSize : null,
            });
        } else {
            drawQtBasicElements(ctx, fontChain, qtMetadata, qtPfp, qtMediaImg, {
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtBoxHeight,
                hasImgs,
                hasVids,
                expandQtMedia,
                expandedMediaSize: qtExpandedMediaSize,
            });
        }
    }

    // --- Draw gallery thumbnails for main tweet (only if supported ext) ---
    if (willDrawGallery) {
        log('gallery', {
            ext,
            atY: mediaY,
            mediaMaxHeight,
            galleryH,
        });

        await renderImageGallery(
            ctx,
            metadata,
            descHeight,
            heightShim,
            mediaMaxHeight,
            560,
            mediaY
        );
    }

    return isImage ? canvas.toBuffer('image/png') : canvas.toBuffer();
}

module.exports = { createTwitterCanvas };
