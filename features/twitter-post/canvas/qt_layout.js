// features/twitter-post/canvas/qt_layout.js

const { scaleDownToFitAspectRatio } = require('../scale_down.js');
const { getWrappedText } = require('../../twitter-core/canvas_utils.js');
const {
    QT,
    getQtTextX,
    getQtWrapWidth,
    getQtInnerRect,
} = require('../../twitter-core/layout/geometry.js');

function trimToMaxChars(s, maxChars) {
    if ((s?.length ?? 0) > maxChars + 50) return s.slice(0, maxChars) + '…';
    return s || '';
}

/**
 * Calculate the total height needed for the quote-tweet rounded box.
 * IMPORTANT: All geometry *must* match drawQtBasicElements to avoid overflow/extra space.
 *
 * This function now derives wrap geometry from shared twitter-core/layout/geometry.js
 * so it cannot drift from drawQtBasicElements.
 */
function calculateQuoteHeight(ctx, qtMetadata) {
    const DEBUG = process.env.DEBUG_QT === '1';
    const TAG = '[qt/calcHeight]';

    try {
        const lineHeight = QT.lineH;
        const bottomPadding = QT.bottomPad;
        const HEADER = QT.headerH;
        const MARGIN_BOTTOM = QT.marginBottom;

        const qtMedia = Array.isArray(qtMetadata.mediaExtended) ? qtMetadata.mediaExtended : [];
        const hasMedia = qtMedia.length > 0;
        const expanded = Boolean(qtMetadata._expandMediaHint);
        const text = qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');

        // Font used for measuring (keep in sync with drawer)
        ctx.font = '24px "Noto Color Emoji"';

        // Geometry derived from shared rules (must match drawQtBasicElements)
        const { innerLeft, innerRight } = getQtInnerRect();
        const textX = getQtTextX({ expandQtMedia: expanded, qtHasMedia: hasMedia });
        const wrapWidth = getQtWrapWidth({ expandQtMedia: expanded, qtHasMedia: hasMedia });

        const lines = getWrappedText(ctx, text, wrapWidth, { preserveEmptyLines: true });
        const descHeight = lines.length * lineHeight;

        if (DEBUG) {
            console.debug(`${TAG} ───────────────────────────────────────────`);
            console.debug(`${TAG} flags: expanded=${expanded} hasMedia=${hasMedia}`);
            console.debug(`${TAG} geom: innerLeft=${innerLeft} innerRight=${innerRight} textX=${textX} wrapWidth=${wrapWidth}`);
            console.debug(`${TAG} text: lines=${lines.length} lineHeight=${lineHeight} descHeight=${descHeight}`);
        }

        // Expanded layout includes large media under text (when hinted + height provided)
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

        // Compact layout (with thumb or no media)
        const COMPACT_MIN_WITH_MEDIA = QT.compactMinWithMedia;
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

/**
 * Measure the *text-needed* height for the QT box using the exact same rules as the drawer.
 * This prevents the drawer from growing the box after canvas height is finalized.
 */
function measureQtTextNeed(ctx, fontChain, qtMetadata, { expandQtMedia = false } = {}) {
    if (!qtMetadata) return 0;

    const qtHasMedia = Array.isArray(qtMetadata.mediaExtended) && qtMetadata.mediaExtended.length > 0;

    // Geometry must mirror drawQtBasicElements (shared rules)
    const textX = getQtTextX({ expandQtMedia, qtHasMedia });
    const wrapWidth = getQtWrapWidth({ expandQtMedia, qtHasMedia });

    // Font MUST match drawer
    ctx.font = `24px ${fontChain}`;

    const desc = qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');
    const qtLines = getWrappedText(ctx, desc, wrapWidth, { preserveEmptyLines: true });

    const LINE_H = QT.lineH;
    const HEADER = QT.headerH;
    const bottomPadding = QT.bottomPad;
    const MARGIN_BOTTOM = QT.marginBottom;

    const textHeight = qtLines.length * LINE_H;

    // Height needed from top of QT box to safely contain text + internal bottom padding
    // NOTE: returned value is relative to top-of-box, not absolute canvas coords.
    return HEADER + textHeight + bottomPadding + MARGIN_BOTTOM;
}

/**
 * Computes QT box sizing and whether media should be expanded.
 * Returns an authoritative qtBoxHeight that should be used consistently for:
 * - total canvas height calculation
 * - drawQtBasicElements qtCanvasHeightOffset
 */
function computeQtSizing(ctx, {
    qtMetadata,
    qtMedia,
    qtFirst,
    hasImgs,
    hasVids,
    fontChain,
    maxQtDescChars,
}) {
    if (!qtMetadata) {
        return {
            qtBoxHeight: 0,
            expandQtMedia: false,
            qtExpandedMediaSize: null,
            qtContainsVideo: false,
        };
    }

    qtMetadata.description = trimToMaxChars(qtMetadata.description, maxQtDescChars);

    const qtContainsVideo = Array.isArray(qtMedia) ? qtMedia.some(m => m.type === 'video') : false;

    // Expansion allowed only if: main has no media AND QT has no video AND first QT item is an image
    let expandQtMedia = (!hasImgs && !hasVids) && !qtContainsVideo && (qtFirst?.type === 'image');

    let qtExpandedMediaSize = null;
    if (expandQtMedia && qtFirst?.size) {
        const size = qtFirst.size?.width && qtFirst.size?.height
            ? { width: qtFirst.size.width, height: qtFirst.size.height }
            : null;

        if (size) {
            // Expanded image is drawn inside inner content width (wrap uses innerRight - innerLeft = 520)
            // Keep maxW=520 consistent with QT inner width.
            qtExpandedMediaSize = scaleDownToFitAspectRatio(size, /*maxH*/ 420, /*maxW*/ 520);
            qtMetadata._expandMediaHint = true;
            qtMetadata._expandedMediaHeight = qtExpandedMediaSize.height;
        } else {
            expandQtMedia = false;
        }
    }

    // 1) Base from calculator (min/media rules)
    const calcHeight = calculateQuoteHeight(ctx, qtMetadata) - (qtMetadata.error ? 40 : 0);
    const qtHasAny = Array.isArray(qtMetadata.mediaExtended) && qtMetadata.mediaExtended.length > 0;

    let minByMedia = calcHeight;

    if (expandQtMedia) {
        // Keep consistent with drawer's baseline assumption for expanded layout
        const minExpanded = (qtMetadata._expandedMediaHeight ?? 0) + 150;
        minByMedia = Math.max(minByMedia, minExpanded);
    } else if (qtHasAny) {
        minByMedia = Math.max(minByMedia, QT.compactMinWithMedia);
    }

    // 2) Text-needed height using *same* wrap/font as drawer
    const textNeed = measureQtTextNeed(ctx, fontChain, qtMetadata, { expandQtMedia });

    // 3) Final box height used for both canvas sizing AND drawing
    const qtBoxHeight = Math.max(minByMedia, textNeed);

    return {
        qtBoxHeight,
        expandQtMedia,
        qtExpandedMediaSize,
        qtContainsVideo,
        calcHeight,
        textNeed,
    };
}

module.exports = {
    calculateQuoteHeight,
    measureQtTextNeed,
    computeQtSizing,
};
