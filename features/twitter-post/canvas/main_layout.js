// features/twitter-post/canvas/main_layout.js

const { measureGalleryHeight } = require('../image_gallery_rendering.js');
const { condenseTranslatedDisplayLines, getWrappedText, trimRenderedLinesToMaxChars } = require('../../twitter-core/canvas_utils.js');
const {
    getMainBaseY,
    getMainLineHeight,
    getMainTextX,
    getMainWrapWidth,
} = require('../../twitter-core/layout/geometry.js');
const {
    MAIN_FONT,
    GAP_TEXT_TO_MEDIA,
    GAP_MEDIA_TO_FOOTER,
    FOOTER_LINE_H,
    FOOTER_FONT_SIZE,
    MAX_DESC_CHARS,
} = require('./constants.js');

function getMainRenderMode({ metadata, hasImgs, hasVids, qtMetadata }) {
    const descLength = String(metadata?.description || '').length;
    const isPureTextMainPost = !hasImgs && !hasVids;
    const hasQuotedTweet = Boolean(qtMetadata);

    if (isPureTextMainPost && !hasQuotedTweet && descLength > MAX_DESC_CHARS) {
        return 'desktop';
    }

    return 'compact';
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
    layoutMode = 'compact',
    mediaMaxHeight,
    debugFonts = false,
    maxDescChars = MAX_DESC_CHARS,
}) {
    /**
     * 🔥 CRITICAL: Ensure measurement uses SAME font as rendering
     */
    ctx.font = MAIN_FONT;

    if (debugFonts) {
        console.log(`[measure-debug] Using MAIN_FONT: ${MAIN_FONT}`);
    }

    const descX = getMainTextX({ hasImgs, hasVids, layoutMode });
    const mainWrapWidth = getMainWrapWidth({ canvasW: maxWidth, hasImgs, hasVids, layoutMode });
    const lineHeight = getMainLineHeight({ layoutMode });

    const rawDesc = metadata.description || '';
    const hasVisibleDesc = rawDesc.trim().length > 0;

    /**
     * 🔍 Optional debug on raw text before wrapping
     */
    if (debugFonts && hasVisibleDesc) {
        debugMeasurement(ctx, 'pre-wrap', rawDesc.slice(0, 80), mainWrapWidth);
    }

    const descLinesRaw = hasVisibleDesc
        ? getWrappedText(ctx, rawDesc, mainWrapWidth, { preserveEmptyLines: true })
        : [];
    const descLines = trimRenderedLinesToMaxChars(
        condenseTranslatedDisplayLines(descLinesRaw),
        maxDescChars
    );

    /**
     * 🔍 Debug wrapped lines
     */
    if (debugFonts && descLines.length > 0) {
        for (let i = 0; i < Math.min(descLines.length, 3); i++) {
            debugMeasurement(ctx, `line-${i}`, descLines[i], mainWrapWidth);
        }
    }

    const baseY = getMainBaseY({ layoutMode });
    const reservedLineCount = descLines.length > 0 ? descLines.length : (hasImgs ? 1 : 0);
    const textHeight = reservedLineCount * lineHeight;
    const descBottomY = baseY + textHeight;

    const { willDrawGallery, ext } = computeWillDrawGallery(images);

    const mediaY = willDrawGallery
        ? (descBottomY + GAP_TEXT_TO_MEDIA)
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
            lineHeight,
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
        lineHeight,
        layoutMode,
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

module.exports = {
    measureMainLayout,
    getMainRenderMode,
};
