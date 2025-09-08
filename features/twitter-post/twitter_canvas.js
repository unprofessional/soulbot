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
    getYPosFromLineHeight
} = require('../twitter-core/canvas_utils.js');
const {
    filterMediaUrls,
    removeTCOLink,
    getExtensionFromMediaUrl
} = require('../twitter-core/utils.js');

const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK']
];

function registerFonts(baseFontUrl = '/usr/share/fonts') {
    FONT_PATHS.forEach(([path, family]) => registerFont(`${baseFontUrl}${path}`, { family }));
}

function getMaxHeight(numImgs) {
    return [0, 800, 600, 530, 530][numImgs] || 600;
}

// Keep this in sync with drawQtBasicElements (MARGIN_BOTTOM uses the same value)
function calculateQuoteHeight(ctx, qtMetadata) {
    const TAG = '[qt/calcHeight]';

    try {
        const lineHeight = 30;
        const bottomPadding = 30;
        const hasMedia = (qtMetadata.mediaUrls?.length ?? 0) > 0;
        const HEADER = 100; // must match top offset used for QT text in drawQtBasicElements
        const text = qtMetadata.error ? qtMetadata.message : qtMetadata.description;

        // keep this font in sync with drawDescription
        ctx.font = '24px "Noto Color Emoji"';

        // When expanded, text spans wider.
        const wrapWidth = (hasMedia && !qtMetadata._expandMediaHint) ? 320 : 520;

        const qtDescLines = getWrappedText(ctx, text || '', wrapWidth);
        const descHeight = qtDescLines.length * lineHeight;

        // Extra inner margin so the image never sits flush with the rounded bottom
        // (must match MARGIN_BOTTOM used in drawQtBasicElements)
        const MARGIN_BOTTOM = 8;

        console.debug(`${TAG} ─────────────────────────────────────────────────────────`);
        console.debug(`${TAG} hasMedia=${hasMedia} _expandMediaHint=${Boolean(qtMetadata._expandMediaHint)} _expandedMediaHeight=${qtMetadata._expandedMediaHeight ?? 'n/a'}`);
        console.debug(`${TAG} wrapWidth=${wrapWidth} textLen=${(text ?? '').length} lines=${qtDescLines.length} descHeight=${descHeight}`);

        if (qtMetadata._expandMediaHint && qtMetadata._expandedMediaHeight) {
            // HEADER + text + gap(20) + expanded media + bottom paddings
            const total =
        HEADER + descHeight + 20 + qtMetadata._expandedMediaHeight + bottomPadding + MARGIN_BOTTOM;
            /* media */ bottomPadding + MARGIN_BOTTOM;

            console.debug(`${TAG} [expanded] desc=${descHeight} + gap=20 + mediaH=${qtMetadata._expandedMediaHeight} + bottomPad=${bottomPadding} + marginBottom=${MARGIN_BOTTOM} => total=${total}`);
            console.debug(`${TAG} ─────────────────────────────────────────────────────────`);
            return total;
        }

        // In compact mode, ensure we include the header as part of the text block height.
        const compactBase = 175 + bottomPadding; // includes header + thumb minimum for media layout
        const textBlock = HEADER + descHeight + bottomPadding + MARGIN_BOTTOM;
        const total = hasMedia ? Math.max(textBlock, compactBase) : textBlock;

        console.debug(`${TAG} [compact] base=${compactBase} hasMedia=${hasMedia} => total=${total}`);
        console.debug(`${TAG} ─────────────────────────────────────────────────────────`);
        return total;
    } catch (e) {
        console.warn('[qt/calcHeight] ERROR (fallback to 205):', e);
        // Safe fallback (~ 175 + 30)
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

    // eslint-disable-next-line no-empty
    const log = (...args) => { try { console.debug('[twitter_canvas]', ...args); } catch {} };

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: removeTCOLink(metadataJson.text),
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
        communityNote: removeTCOLink(metadataJson.communityNote)
    };

    const qtMetadata = metadataJson.qtMetadata ? {
        authorNick: metadataJson.qtMetadata?.user_screen_name || '',
        authorUsername: metadataJson.qtMetadata?.user_name || '',
        pfpUrl: metadataJson.qtMetadata?.user_profile_image_url || '',
        date: metadataJson.qtMetadata?.date || '',
        description: metadataJson.qtMetadata?.text || '',
        mediaUrls: metadataJson.qtMetadata?.mediaURLs || [],
        mediaExtended: metadataJson.qtMetadata?.media_extended || [],
        ...(metadataJson.qtMetadata.error && { ...metadataJson.qtMetadata })
    } : null;

    // ---- Main media metrics ----
    const numImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    const numVids = filterMediaUrls(metadata, ['mp4']).length;
    const hasImgs = numImgs > 0;
    const hasVids = numVids > 0;
    const onlyVids = hasVids && !hasImgs;

    const mediaMaxHeight = getMaxHeight(numImgs);
    let heightShim = 0;

    let mediaObj = { height: 0, width: 0 };
    if (hasImgs) {
        mediaObj = scaleDownToFitAspectRatio(
            metadata.mediaExtended[0].size,
            mediaMaxHeight,
            560
        );
        heightShim = (metadata.mediaExtended.length < 2 && mediaObj.width > mediaObj.height)
            ? mediaObj.height * (560 / mediaObj.width)
            : Math.min(mediaObj.height, mediaMaxHeight);
    }

    const MAX_DESC_CHARS = 1000;
    const MAX_QT_DESC_CHARS = 500;

    if ((metadata.description?.length ?? 0) > MAX_DESC_CHARS + 50) {
        metadata.description = metadata.description.slice(0, MAX_DESC_CHARS) + '…';
    }

    const maxCharLength = onlyVids ? 120 : 240;
    const descLines = getWrappedText(ctx, metadata.description || '', maxCharLength);
    const baseY = 110;
    const descHeight = (descLines.length * 30) + baseY + 40 + heightShim;

    // Debug: main tweet layout
    log('main', {
        numImgs, numVids, hasImgs, hasVids, onlyVids,
        mediaMaxHeight, mediaObj, heightShim,
        textLen: (metadata.description || '').length,
        descLines: descLines.length,
        descHeight, baseY
    });

    // --- Quote tweet sizing (supports "expanded" media when main has no media) ---
    let qtHeight = 0;
    let expandQtMedia = false;
    let qtExpandedMediaSize = null;

    if (qtMetadata) {
        if ((qtMetadata.description?.length ?? 0) > MAX_QT_DESC_CHARS + 50) {
            qtMetadata.description = qtMetadata.description.slice(0, MAX_QT_DESC_CHARS) + '…';
        }

        const qtHasImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length > 0;
        const qtHasVids = filterMediaUrls(qtMetadata, ['mp4']).length > 0;

        // Expand quoted image to large/full preview if the main post has no media
        expandQtMedia = (!hasImgs && !hasVids) && qtHasImgs && !qtHasVids;

        if (expandQtMedia) {
            const firstSize = qtMetadata.mediaExtended?.[0]?.size;
            if (firstSize?.width && firstSize?.height) {
                // near full width inside the quote box
                qtExpandedMediaSize = scaleDownToFitAspectRatio(firstSize, /*maxH*/ 420, /*maxW*/ 520);
                qtMetadata._expandMediaHint = true;
                qtMetadata._expandedMediaHeight = qtExpandedMediaSize.height;
            }
        }

        // Debug: QT decision before height calc
        log('qt:pre', {
            exists: true,
            qtHasImgs, qtHasVids,
            expandQtMedia,
            firstSize: qtMetadata.mediaExtended?.[0]?.size || null,
            qtExpandedMediaSize
        });

        qtHeight = calculateQuoteHeight(ctx, qtMetadata) + 40 - (qtMetadata.error ? 40 : 0);

        // Debug: QT after height calc
        log('qt:post', { qtHeight });
    } else {
        log('qt:none');
    }

    const totalHeight = descHeight + qtHeight;
    canvas.height = totalHeight;
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    // Debug: overall canvas
    log('canvas', { maxWidth, totalHeight });

    const [favicon, pfp] = await Promise.all([
        safeLoadImage('https://abs.twimg.com/favicons/twitter.3.ico'),
        safeLoadImage(metadata.pfpUrl)
    ]);
    log('assets', { faviconLoaded: Boolean(favicon), pfpLoaded: Boolean(pfp) });

    const useDesktopLayout = false;

    if (useDesktopLayout) {
        drawDesktopLayout(ctx, font, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight
        });
    } else {
        drawBasicElements(ctx, font, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight
        });
    }

    if (qtMetadata) {
        const qtPfp = await safeLoadImage(qtMetadata.pfpUrl);
        const numQtImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length;
        const numQtVids = filterMediaUrls(qtMetadata, ['mp4']).length;

        if (!qtMetadata.error) {
            const hasQtMedia = numQtImgs > 0 || numQtVids > 0;
            const qtMediaUrl = hasQtMedia
                ? qtMetadata.mediaExtended?.[0]?.thumbnail_url || qtMetadata.mediaUrls?.[0] || null
                : null;
            const qtMediaImg = qtMediaUrl ? await safeLoadImage(qtMediaUrl) : undefined;

            const qtUseDesktopLayout = false;

            // Debug: draw call params
            log('qt:draw', {
                qtUseDesktopLayout,
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtHeight,
                expandQtMedia,
                expandedMediaSize: qtExpandedMediaSize,
                qtPfpLoaded: Boolean(qtPfp),
                qtMediaImgLoaded: Boolean(qtMediaImg)
            });

            if (qtUseDesktopLayout) {
                drawQtDesktopLayout(ctx, font, qtMetadata, qtPfp, qtMediaImg, {
                    canvasHeightOffset: descHeight,
                    qtCanvasHeightOffset: qtHeight,
                    expandQtMedia,
                    expandedMediaSize: expandQtMedia ? qtExpandedMediaSize : null
                });
            } else {
                drawQtBasicElements(ctx, font, qtMetadata, qtPfp, qtMediaImg, {
                    canvasHeightOffset: descHeight,
                    qtCanvasHeightOffset: qtHeight,
                    hasImgs,
                    hasVids,
                    expandQtMedia,
                    expandedMediaSize: qtExpandedMediaSize
                });
            }
        } else {
            log('qt:error', { message: qtMetadata.message });
            drawQtMissingStatus(ctx, font, qtMetadata.message, {
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtHeight,
                hasImgs: false,
                hasVids: false
            });
        }
    }

    const ext = metadata.mediaExtended?.[0]?.thumbnail_url &&
        getExtensionFromMediaUrl(metadata.mediaExtended[0].thumbnail_url);
    const allowedExts = ['jpg', 'jpeg', 'png'];
    if (allowedExts.includes(ext)) {
        log('gallery', { ext, atY: getYPosFromLineHeight(descLines, baseY), heightShim, mediaMaxHeight });
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
