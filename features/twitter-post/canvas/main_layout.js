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

function measureMainLayout(ctx, {
    metadata,
    images,
    hasImgs,
    hasVids,
    maxWidth,
    mediaMaxHeight,
}) {
    ctx.font = MAIN_FONT;

    // Always bound length; preserve metadata shape for downstream users
    metadata.description = trimToMaxChars(metadata.description, MAX_DESC_CHARS);

    const descX = getMainTextX({ hasImgs, hasVids });
    const mainWrapWidth = getMainWrapWidth({ canvasW: maxWidth, hasImgs, hasVids });

    // Avoid phantom empty line height when description is blank
    const rawDesc = metadata.description || '';
    const hasVisibleDesc = rawDesc.trim().length > 0;

    const descLines = hasVisibleDesc
        ? getWrappedText(ctx, rawDesc, mainWrapWidth, { preserveEmptyLines: true })
        : [];

    const baseY = MAIN.baseY;
    const textHeight = descLines.length * MAIN.lineH;
    const descBottomY = baseY + textHeight;

    const { willDrawGallery, ext } = computeWillDrawGallery(images);

    // When there is no visible description, anchor media closer to header instead of MAIN.baseY.
    // This prevents large "phantom" padding for media-only tweets (often just a trailing t.co link).
    const NO_DESC_MEDIA_Y = 78; // tuned to your current header geometry (avatar/name/handle block)
    const mediaY = willDrawGallery
        ? (hasVisibleDesc ? (descBottomY + GAP_TEXT_TO_MEDIA) : NO_DESC_MEDIA_Y)
        : 0;

    const galleryH = willDrawGallery ? measureGalleryHeight(metadata, mediaMaxHeight, 560) : 0;

    // Keep legacy no-media footer spacing (descBottomY + 40)
    const footerBaselineY = willDrawGallery
        ? (mediaY + galleryH + GAP_MEDIA_TO_FOOTER + FOOTER_FONT_SIZE)
        : (descBottomY + 40);

    const bodyBottomY = willDrawGallery
        ? (mediaY + galleryH + GAP_MEDIA_TO_FOOTER + FOOTER_LINE_H)
        : (footerBaselineY + FOOTER_LINE_H);

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
