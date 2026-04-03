// features/twitter-post/canvas/main_layout.js

const { measureGalleryHeight } = require('../image_gallery_rendering.js');
const { getWrappedText } = require('../../twitter-core/canvas_utils.js');
const { getMainTextX, getMainWrapWidth, MAIN } = require('../../twitter-core/layout/geometry.js');
const {
    MAIN_FONT,
    GAP_TEXT_TO_MEDIA,
    GAP_MEDIA_TO_FOOTER,
    FOOTER_LINE_H,
    FOOTER_FONT_SIZE,
    MAX_DESC_CHARS,
} = require('./constants.js');

function trimToMaxChars(s, maxChars) {
    const str = s || '';
    if (str.length > maxChars + 50) return str.slice(0, maxChars) + '…';
    return str;
}

function computeWillDrawGallery(images) {
    const first = images?.[0];
    const firstThumbUrl = first?.thumbnail_url || first?.url || null;

    const extMatch = firstThumbUrl ? firstThumbUrl.match(/\.(jpe?g|png)(\?|#|$)/i) : null;
    const ext = extMatch ? extMatch[1].toLowerCase() : null;

    const allowedExts = new Set(['jpg', 'jpeg', 'png']);
    return { willDrawGallery: Boolean(ext && allowedExts.has(ext)), ext };
}

/**
 * 🔍 Debug helper for measurement phase
 */
function debugMeasurement(ctx, label, text, widthLimit) {
    const measured = ctx.measureText(text).width;
    console.log(
        `[measure-debug] ${label} | font=${ctx.font} | width=${measured} | max=${widthLimit} | text="${text}"`
    );
}

function measureMainLayout(ctx, {
    metadata,
    images,
    hasImgs,
    hasVids,
    maxWidth,
    mediaMaxHeight,
    debugFonts = false,
}) {
    /**
     * 🔥 CRITICAL: Ensure measurement uses SAME font as rendering
     */
    ctx.font = MAIN_FONT;

    if (debugFonts) {
        console.log(`[measure-debug] Using MAIN_FONT: ${MAIN_FONT}`);
    }

    // Always bound length; preserve metadata shape for downstream users
    metadata.description = trimToMaxChars(metadata.description, MAX_DESC_CHARS);

    const descX = getMainTextX({ hasImgs, hasVids });
    const mainWrapWidth = getMainWrapWidth({ canvasW: maxWidth, hasImgs, hasVids });

    const rawDesc = metadata.description || '';
    const hasVisibleDesc = rawDesc.trim().length > 0;

    /**
     * 🔍 Optional debug on raw text before wrapping
     */
    if (debugFonts && hasVisibleDesc) {
        debugMeasurement(ctx, 'pre-wrap', rawDesc.slice(0, 80), mainWrapWidth);
    }

    const descLines = hasVisibleDesc
        ? getWrappedText(ctx, rawDesc, mainWrapWidth, { preserveEmptyLines: true })
        : [];

    /**
     * 🔍 Debug wrapped lines
     */
    if (debugFonts && descLines.length > 0) {
        for (let i = 0; i < Math.min(descLines.length, 3); i++) {
            debugMeasurement(ctx, `line-${i}`, descLines[i], mainWrapWidth);
        }
    }

    const baseY = MAIN.baseY;
    const textHeight = descLines.length * MAIN.lineH;
    const descBottomY = baseY + textHeight;

    const { willDrawGallery, ext } = computeWillDrawGallery(images);

    const NO_DESC_MEDIA_Y = 78;

    const mediaY = willDrawGallery
        ? (hasVisibleDesc ? (descBottomY + GAP_TEXT_TO_MEDIA) : NO_DESC_MEDIA_Y)
        : 0;

    const galleryH = willDrawGallery
        ? measureGalleryHeight(metadata, mediaMaxHeight, 560)
        : 0;

    const footerBaselineY = willDrawGallery
        ? (mediaY + galleryH + GAP_MEDIA_TO_FOOTER + FOOTER_FONT_SIZE)
        : (descBottomY + 40);

    const bodyBottomY = willDrawGallery
        ? (mediaY + galleryH + GAP_MEDIA_TO_FOOTER + FOOTER_LINE_H)
        : (footerBaselineY + FOOTER_LINE_H);

    /**
     * 🔍 Final layout debug
     */
    if (debugFonts) {
        console.log('[layout-debug]', {
            lines: descLines.length,
            textHeight,
            descBottomY,
            mediaY,
            galleryH,
            footerBaselineY,
            bodyBottomY,
            font: ctx.font,
        });
    }

    return {
        // text
        descX,
        mainWrapWidth,
        descLines,
        baseY,
        textHeight,
        descBottomY,

        // media/gallery
        willDrawGallery,
        ext,
        mediaY,
        galleryH,

        // footer + body bottom
        footerBaselineY,
        bodyBottomY,
    };
}

module.exports = { measureMainLayout };
