// features/twitter-post/canvas/qt_layout.js

const { scaleDownToFitAspectRatio } = require('../scale_down.js');
const { condenseTranslatedDisplayLines, getWrappedText, trimRenderedLinesToMaxChars } = require('../../twitter-core/canvas_utils.js');
const {
    QT,
    getQtTextX,
    getQtWrapWidth,
    getQtInnerRect,
    getQtCompactContentBottom,
    getQtCompactFooterReserve,
} = require('../../twitter-core/layout/geometry.js');

/**
 * Calculate the total height needed for the quote-tweet rounded box.
 * IMPORTANT: All geometry *must* match drawQtBasicElements to avoid overflow/extra space.
 *
 * This function now derives wrap geometry from shared twitter-core/layout/geometry.js
 * so it cannot drift from drawQtBasicElements.
 */
function calculateQuoteHeight(ctx, qtMetadata, { fontChain = 'sans-serif' } = {}) {
    const DEBUG = process.env.DEBUG_QT === '1';
    const TAG = '[qt/calcHeight]';

    try {
        const lineHeight = QT.lineH;
        const bottomPadding = QT.bottomPad;
        const HEADER = QT.headerH;
        const MARGIN_BOTTOM = QT.marginBottom;
        const hasFooter = Boolean(qtMetadata._displayDateFooter);

        // Footer sizing (must match qt_draw.js)
        const QT_FOOTER_LINE_H = 24;

        const qtMedia = Array.isArray(qtMetadata.mediaExtended) ? qtMetadata.mediaExtended : [];
        const hasMedia = qtMedia.length > 0;
        const expanded = Boolean(qtMetadata._expandMediaHint);
        const text = qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');

        ctx.font = `24px ${fontChain}`;

        const { innerLeft, innerRight } = getQtInnerRect();
        const textX = getQtTextX({ expandQtMedia: expanded, qtHasMedia: hasMedia });
        const wrapWidth = getQtWrapWidth({ expandQtMedia: expanded, qtHasMedia: hasMedia });

        const lines = condenseTranslatedDisplayLines(
            getWrappedText(ctx, text, wrapWidth, { preserveEmptyLines: true })
        );
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
                bottomPadding + MARGIN_BOTTOM +
                (hasFooter ? QT_FOOTER_LINE_H : 0);

            DEBUG && console.debug(
                `${TAG} [expanded] parts: HEADER=${HEADER} desc=${descHeight} gap=20 media=${qtMetadata._expandedMediaHeight} bottomPad=${bottomPadding} marginBottom=${MARGIN_BOTTOM} footer=${hasFooter ? QT_FOOTER_LINE_H : 0} => total=${total}`
            );
            DEBUG && console.debug(`${TAG} ───────────────────────────────────────────`);
            return total;
        }

        const contentBottom = getQtCompactContentBottom({ textHeight: descHeight, qtHasMedia: hasMedia });
        const footerReserve = getQtCompactFooterReserve({ hasFooter });
        const total = contentBottom + footerReserve;

        DEBUG && console.debug(
            `${TAG} [compact] hasMedia=${hasMedia} contentBottom=${contentBottom} footerReserve=${footerReserve} hasFooter=${hasFooter} => total=${total}`
        );
        DEBUG && console.debug(`${TAG} ───────────────────────────────────────────`);
        return total;
    } catch (e) {
        console.warn('[qt/calcHeight] ERROR (fallback to 205):', e);
        return 205;
    }
}

function measureQtTextNeed(ctx, fontChain, qtMetadata, { expandQtMedia = false } = {}) {
    if (!qtMetadata) return 0;

    const qtHasMedia = Array.isArray(qtMetadata.mediaExtended) && qtMetadata.mediaExtended.length > 0;
    const hasFooter = Boolean(qtMetadata._displayDateFooter);

    // Footer sizing (must match qt_draw.js)
    const QT_FOOTER_LINE_H = 24;

    const wrapWidth = getQtWrapWidth({ expandQtMedia, qtHasMedia });

    ctx.font = `24px ${fontChain}`;

    const desc = qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');
    const qtLines = condenseTranslatedDisplayLines(
        getWrappedText(ctx, desc, wrapWidth, { preserveEmptyLines: true })
    );

    const LINE_H = QT.lineH;
    const HEADER = QT.headerH;
    const bottomPadding = QT.bottomPad;
    const MARGIN_BOTTOM = QT.marginBottom;

    const textHeight = qtLines.length * LINE_H;

    if (!expandQtMedia) {
        return getQtCompactContentBottom({ textHeight, qtHasMedia }) +
            getQtCompactFooterReserve({ hasFooter });
    }

    return HEADER + textHeight + bottomPadding + MARGIN_BOTTOM + (hasFooter ? QT_FOOTER_LINE_H : 0);
}

function shouldExpandQtMedia({ qtFirst, hasImgs, hasVids, qtContainsVideo }) {
    return (!hasImgs && !hasVids) && !qtContainsVideo && (qtFirst?.type === 'image');
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

    ctx.font = `24px ${fontChain}`;
    const qtContainsVideo = Array.isArray(qtMedia) ? qtMedia.some(m => m.type === 'video') : false;
    let expandQtMedia = shouldExpandQtMedia({ qtFirst, hasImgs, hasVids, qtContainsVideo });

    const initialWrapWidth = getQtWrapWidth({
        expandQtMedia,
        qtHasMedia: Array.isArray(qtMetadata.mediaExtended) && qtMetadata.mediaExtended.length > 0,
    });
    const initialRenderedLines = trimRenderedLinesToMaxChars(
        condenseTranslatedDisplayLines(
            getWrappedText(ctx, qtMetadata.description || '', initialWrapWidth, { preserveEmptyLines: true })
        ),
        maxQtDescChars
    );
    qtMetadata.description = initialRenderedLines.join('\n');

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
    const calcHeight = calculateQuoteHeight(ctx, qtMetadata, { fontChain }) - (qtMetadata.error ? 40 : 0);
    const qtHasAny = Array.isArray(qtMetadata.mediaExtended) && qtMetadata.mediaExtended.length > 0;

    let minByMedia = calcHeight;

    if (expandQtMedia) {
        // Keep consistent with drawer's baseline assumption for expanded layout
        const minExpanded = (qtMetadata._expandedMediaHeight ?? 0) + 150;
        minByMedia = Math.max(minByMedia, minExpanded);
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
    shouldExpandQtMedia,
};
