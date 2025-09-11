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
const {
    filterMediaUrls,
    removeTCOLink,
    getExtensionFromMediaUrl,
} = require('../twitter-core/utils.js');

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
    const TAG = '[qt/calcHeight]';

    try {
        const lineHeight = 30;
        const bottomPadding = 30;
        const HEADER = 100;        // vertical space above first text line (names/handle area)
        const MARGIN_BOTTOM = 8;   // inner margin at the rounded bottom (matches drawQtBasicElements)

        // Media flags / expansion hints determined by caller
        const hasMedia = (qtMetadata.mediaUrls?.length ?? 0) > 0;
        const expanded = Boolean(qtMetadata._expandMediaHint);
        const text =
      qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');

        // Font used for measuring (keep in sync with drawDescription)
        ctx.font = '24px "Noto Color Emoji"';

        // --- Compute wrap width from the SAME geometry the draw path uses ---
        // Quote box geometry (must mirror drawQtBasicElements)
        const qtX = 20;          // left edge of the quoted box
        const boxW = 560;        // quoted box width
        const innerPad = 20;     // inner padding inside the box
        const innerLeft = qtX + innerPad;               // 40
        const innerRight = qtX + boxW - innerPad;       // 560

        // drawQtBasicElements uses:
        //   textX = expanded ? innerLeft : (hasMedia ? 230 : 100)
        const textX = expanded ? innerLeft : (hasMedia ? 230 : 100);
        const wrapWidth = Math.max(1, innerRight - textX); // 520, 330, or 460

        const qtDescLines = getWrappedText(ctx, text, wrapWidth);
        const descHeight = qtDescLines.length * lineHeight;

        // Debug logging
        try {
            console.debug(
                `${TAG} expanded=${expanded} hasMedia=${hasMedia} wrapWidth=${wrapWidth} ` +
        `lines=${qtDescLines.length} descHeight=${descHeight}`
            );
        } catch {}

        if (expanded && qtMetadata._expandedMediaHeight) {
            // Expanded layout: names/header + text + gap(20) + image + paddings
            const total =
        HEADER + descHeight + 20 + qtMetadata._expandedMediaHeight + bottomPadding + MARGIN_BOTTOM;
            return total;
        }

        // Compact layout: ensure a minimum when media thumb is shown on the left
        const compactBase = 175 + bottomPadding; // min to fit avatar + 175px thumb + padding
        const textBlock = HEADER + descHeight + bottomPadding + MARGIN_BOTTOM;
        const total = hasMedia ? Math.max(textBlock, compactBase) : textBlock;

        return total;
    } catch (e) {
        console.warn('[qt/calcHeight] ERROR (fallback to 205):', e);
        // Safe fallback (~175 + 30)
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

    // --- Normalize incoming metadata ---
    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: removeTCOLink(metadataJson.text),
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
        communityNote: removeTCOLink(metadataJson.communityNote),
    };

    const qtMetadata = metadataJson.qtMetadata
        ? {
            authorNick: metadataJson.qtMetadata?.user_screen_name || '',
            authorUsername: metadataJson.qtMetadata?.user_name || '',
            pfpUrl: metadataJson.qtMetadata?.user_profile_image_url || '',
            date: metadataJson.qtMetadata?.date || '',
            description: metadataJson.qtMetadata?.text || '',
            mediaUrls: metadataJson.qtMetadata?.mediaURLs || [],
            mediaExtended: metadataJson.qtMetadata?.media_extended || [],
            ...(metadataJson.qtMetadata.error && { ...metadataJson.qtMetadata }),
        }
        : null;

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
        heightShim =
      (metadata.mediaExtended.length < 2 && mediaObj.width > mediaObj.height)
          ? mediaObj.height * (560 / mediaObj.width)
          : Math.min(mediaObj.height, mediaMaxHeight);
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
            qtMetadata.description =
        qtMetadata.description.slice(0, MAX_QT_DESC_CHARS) + '…';
        }

        const qtHasImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length > 0;
        const qtHasVids = filterMediaUrls(qtMetadata, ['mp4']).length > 0;

        // Expand quoted image to large/full preview if the main post has no media
        expandQtMedia = (!hasImgs && !hasVids) && qtHasImgs && !qtHasVids;

        if (expandQtMedia) {
            const firstSize = qtMetadata.mediaExtended?.[0]?.size;
            if (firstSize?.width && firstSize?.height) {
                // near full width inside the quote box
                qtExpandedMediaSize = scaleDownToFitAspectRatio(firstSize, /* maxH */ 420, /* maxW */ 520);
                qtMetadata._expandMediaHint = true;
                qtMetadata._expandedMediaHeight = qtExpandedMediaSize.height;
            }
        }

        log('qt:pre', {
            exists: true,
            qtHasImgs, qtHasVids,
            expandQtMedia,
            firstSize: qtMetadata.mediaExtended?.[0]?.size || null,
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
        const numQtImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length;
        const numQtVids = filterMediaUrls(qtMetadata, ['mp4']).length;

        if (!qtMetadata.error) {
            const hasQtMedia = numQtImgs > 0 || numQtVids > 0;
            const qtMediaUrl = hasQtMedia
                ? qtMetadata.mediaExtended?.[0]?.thumbnail_url ||
          qtMetadata.mediaUrls?.[0] ||
          null
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
        } else {
            log('qt:error', { message: qtMetadata.message });
            drawQtMissingStatus(ctx, font, qtMetadata.message, {
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtHeight,
                hasImgs: false,
                hasVids: false,
            });
        }
    }

    // Optional: draw gallery thumbnails for main tweet
    const ext =
    metadata.mediaExtended?.[0]?.thumbnail_url &&
    getExtensionFromMediaUrl(metadata.mediaExtended[0].thumbnail_url);
    const allowedExts = ['jpg', 'jpeg', 'png'];

    if (allowedExts.includes(ext)) {
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
