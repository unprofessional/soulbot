/* eslint-disable no-empty */
// features/twitter-post/twitter_canvas.js

const { createCanvas } = require('canvas');
const { renderImageGallery } = require('./image_gallery_rendering.js');
const {
    drawBasicElements,
    drawQtBasicElements,
    drawQtDesktopLayout,
} = require('../twitter-core/canvas_utils.js');
const {
    MAX_WIDTH,
    DESKTOP_MAX_WIDTH,
    INITIAL_HEIGHT,
    DEFAULT_BOTTOM_PAD_NO_QT,
    DEFAULT_BOTTOM_PAD_WITH_QT,
    DESKTOP_MAX_DESC_CHARS,
    MAX_QT_DESC_CHARS,
    getMaxHeight,
    FOOTER_LINE_H,
    FOOTER_FONT_SIZE,
    GAP_FOOTER_TO_QT,
    TEXT_FONT_FAMILY,
} = require('./canvas/constants.js');
const { debugRect } = require('./canvas/debug.js');
const { safeLoadImage } = require('./canvas/safe_load_image.js');
const {
    normalizeMainMetadata,
    normalizeQtMetadata,
    formatReplyDelta,
} = require('./canvas/metadata_normalize.js');
const { measureMainLayout, getMainRenderMode } = require('./canvas/main_layout.js');
const { computeQtSizing } = require('./canvas/qt_layout.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');

async function createTwitterCanvas(metadataJson, isImage) {
    const fontChain = TEXT_FONT_FAMILY;
    const debugFonts = process.env.DEBUG_CANVAS_FONTS === '1';

    const canvas = createCanvas(MAX_WIDTH, INITIAL_HEIGHT);
    const ctx = canvas.getContext('2d');

    const { execSync } = require('child_process');

    try {
        console.log('----- FONT DEBUG START -----');
        console.log(execSync('fc-match "Liberation Sans"').toString());
        console.log(execSync('fc-match "DejaVu Sans"').toString());
        console.log(execSync('fc-match "Noto Sans JP"').toString());
        console.log('----- FONT DEBUG END -----');
    } catch (e) {
        console.error('Font debug failed:', e.message);
    }

    ctx.font = '24px "Liberation Sans"';
    console.log('Liberation width:', ctx.measureText('1234567890').width);

    ctx.font = '24px "DejaVu Sans"';
    console.log('DejaVu width:', ctx.measureText('1234567890').width);

    ctx.font = '24px "Noto Sans JP"';
    console.log('Noto JP width:', ctx.measureText('1234567890').width);

    ctx.fillStyle = '#000';
    ctx.textDrawingMode = 'glyph';

    const log = (...args) => {
        try { console.debug('[twitter_canvas]', ...args); } catch {}
    };

    console.debug('[date] canvas.input', {
        date: metadataJson?.date,
        date_epoch: metadataJson?.date_epoch,
        created_timestamp: metadataJson?.created_timestamp,
        created_at: metadataJson?.created_at,
        tweet_created_at: metadataJson?.tweet?.created_at,
    });

    const { metadata, images, videos } = normalizeMainMetadata(metadataJson);

    console.debug('[date] canvas.meta', {
        from_meta: {
            date: metadata.date,
            date_epoch: metadata.date_epoch,
            created_timestamp: metadata.created_timestamp,
        },
        _displayDate: metadata._displayDate,
        _displayDateFooter: metadata._displayDateFooter,
    });

    const qt = metadataJson.qtMetadata || null;
    const qtNorm = normalizeQtMetadata(qt);
    const qtMetadata = qtNorm?.qtMetadata || null;

    if (qtMetadata) {
        metadata._replyDelta = formatReplyDelta(qtMetadata, metadata);
    }

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

    const numImgs = images.length;
    const numVids = videos.length;
    const hasImgs = numImgs > 0;
    const hasVids = numVids > 0;
    const onlyVids = hasVids && !hasImgs;
    const mainRenderMode = getMainRenderMode({
        metadata,
        hasImgs,
        hasVids,
        qtMetadata,
    });
    const canvasWidth = mainRenderMode === 'desktop' ? DESKTOP_MAX_WIDTH : MAX_WIDTH;
    const maxMainDescChars = mainRenderMode === 'desktop' ? DESKTOP_MAX_DESC_CHARS : undefined;

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

    const main = measureMainLayout(ctx, {
        metadata,
        images,
        hasImgs,
        hasVids,
        maxWidth: canvasWidth,
        layoutMode: mainRenderMode,
        mediaMaxHeight,
        debugFonts,
        maxDescChars: maxMainDescChars,
    });

    const {
        descX,
        mainWrapWidth,
        layoutMode,
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

    const mainBodyBottomY = bodyBottomY;
    const qtStartY = qtMetadata ? (mainBodyBottomY + GAP_FOOTER_TO_QT) : mainBodyBottomY;
    const descHeight = mainBodyBottomY;

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
        fontChain,
        debugFonts,
        mainRenderMode,
        canvasWidth,
    });

    debugRect(
        ctx,
        descX,
        baseY - 30 + 6,
        mainWrapWidth,
        textHeight,
        `Main text (w=${mainWrapWidth})`
    );

    if (process.env.DEBUG_CANVAS_BOXES === '1' && willDrawGallery) {
        debugRect(ctx, 20, mediaY, 560, galleryH, `Gallery (h=${galleryH})`);
        debugRect(
            ctx,
            30,
            footerBaselineY - FOOTER_FONT_SIZE,
            540,
            FOOTER_LINE_H,
            'Footer line box'
        );
    }

    log('main', {
        numImgs,
        numVids,
        hasImgs,
        hasVids,
        onlyVids,
        mediaMaxHeight,
        mediaObj,
        heightShim,
        willDrawGallery,
        galleryH,
        textLen: (metadata.description || '').length,
        descLines: descLines.length,
        descHeight,
        baseY,
        mainRenderMode,
        canvasWidth,
    });

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
            fontChain,
        });
    } else {
        log('qt:none');
    }

    const extraBottomPad = qtMetadata
        ? DEFAULT_BOTTOM_PAD_WITH_QT
        : DEFAULT_BOTTOM_PAD_NO_QT;

    const totalHeight = qtMetadata
        ? (qtStartY + qtBoxHeight + extraBottomPad)
        : (descHeight + extraBottomPad);

    canvas.width = canvasWidth;
    canvas.height = totalHeight;

    // Canvas resize resets context state; reapply the essentials.
    ctx.fillStyle = '#000';
    ctx.textDrawingMode = 'glyph';
    ctx.fillRect(0, 0, canvasWidth, totalHeight);

    if (process.env.DEBUG_CANVAS_BOXES === '1') {
        ctx.save();
        ctx.strokeStyle = '#ff66aa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 0.5);
        ctx.lineTo(canvasWidth, canvas.height - 0.5);
        ctx.stroke();
        ctx.restore();
    }

    log('canvas', { canvasWidth, totalHeight, mainRenderMode });

    const [favicon, pfp] = await Promise.all([
        safeLoadImage('https://abs.twimg.com/favicons/twitter.3.ico'),
        safeLoadImage(metadata.pfpUrl),
    ]);

    log('assets', {
        faviconLoaded: Boolean(favicon),
        pfpLoaded: Boolean(pfp),
    });

    drawBasicElements(ctx, fontChain, metadata, favicon, pfp, descLines, {
        hasImgs,
        hasVids,
        layoutMode,
        yOffset: baseY,
        canvasHeightOffset: descHeight,
        footerY: footerBaselineY,
        debugFonts,
    });

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
            fontChain,
        });

        if (qtUseDesktopLayout) {
            drawQtDesktopLayout(ctx, fontChain, qtMetadata, qtPfp, qtMediaImg, {
                canvasHeightOffset: qtStartY,
                qtCanvasHeightOffset: qtBoxHeight,
                expandQtMedia,
                expandedMediaSize: expandQtMedia ? qtExpandedMediaSize : null,
            });
        } else {
            drawQtBasicElements(ctx, fontChain, qtMetadata, qtPfp, qtMediaImg, {
                canvasHeightOffset: qtStartY,
                qtCanvasHeightOffset: qtBoxHeight,
                hasImgs,
                hasVids,
                expandQtMedia,
                expandedMediaSize: qtExpandedMediaSize,
            });
        }
    }

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
