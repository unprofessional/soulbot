// features/twitter-post/canvas/main_layout.js

const { measureGalleryHeight } = require('../image_gallery_rendering.js');
const { getWrappedText } = require('../../twitter-core/canvas_utils.js');
const { getMainTextX, getMainWrapWidth, MAIN } = require('../../twitter-core/layout/geometry.js');
const {
    MAIN_FONT,
    MAIN_LINE_HEIGHT,
    GAP_TEXT_TO_MEDIA,
    GAP_MEDIA_TO_FOOTER,
    FOOTER_LINE_H,
    FOOTER_FONT_SIZE,
    MAX_DESC_CHARS,
} = require('./constants.js');

function trimToMaxChars(s, maxChars) {
    if ((s?.length ?? 0) > maxChars + 50) return s.slice(0, maxChars) + '…';
    return s || '';
}

function computeWillDrawGallery(images) {
    const firstThumbUrl = images?.[0]?.thumbnail_url || images?.[0]?.url || null;
    const extMatch = firstThumbUrl ? firstThumbUrl.match(/\.(jpe?g|png)(\?|#|$)/i) : null;
    const ext = extMatch ? extMatch[1].toLowerCase() : null;
    const allowedExts = ['jpg', 'jpeg', 'png'];
    return { willDrawGallery: Boolean(ext && allowedExts.includes(ext)), ext };
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

    // Always bound length
    metadata.description = trimToMaxChars(metadata.description, MAX_DESC_CHARS);

    const descX = getMainTextX({ hasImgs, hasVids });
    const mainWrapWidth = getMainWrapWidth({ canvasW: maxWidth, hasImgs, hasVids });

    const descLines = getWrappedText(ctx, metadata.description || '', mainWrapWidth, { preserveEmptyLines: true });

    const baseY = MAIN.baseY;
    const textHeight = descLines.length * MAIN.lineH;
    const descBottomY = baseY + textHeight;

    const { willDrawGallery, ext } = computeWillDrawGallery(images);

    const mediaY = willDrawGallery ? (descBottomY + GAP_TEXT_TO_MEDIA) : 0;
    const galleryH = willDrawGallery ? measureGalleryHeight(metadata, mediaMaxHeight, 560) : 0;

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
