// features/twitter-post/canvas/qt_layout.js

const { scaleDownToFitAspectRatio } = require('../scale_down.js');
const { getWrappedText } = require('../../twitter-core/canvas_utils.js');

function trimToMaxChars(s, maxChars) {
    if ((s?.length ?? 0) > maxChars + 50) return s.slice(0, maxChars) + '…';
    return s || '';
}

/**
 * Calculate the total height needed for the quote-tweet rounded box.
 * IMPORTANT: All geometry *must* match drawQtBasicElements to avoid overflow/extra space.
 */
function calculateQuoteHeight(ctx, qtMetadata) {
    const DEBUG = process.env.DEBUG_QT === '1';
    const TAG = '[qt/calcHeight]';

    try {
        const lineHeight = 30;
        const bottomPadding = 30;
        const HEADER = 100;
        const MARGIN_BOTTOM = 8;

        const qtMedia = Array.isArray(qtMetadata.mediaExtended) ? qtMetadata.mediaExtended : [];
        const hasMedia = qtMedia.length > 0;
        const expanded = Boolean(qtMetadata._expandMediaHint);
        const text = qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');

        ctx.font = '24px "Noto Color Emoji"';

        const qtX = 20;
        const boxW = 560;
        const innerPad = 20;
        const innerLeft = qtX + innerPad;
        const innerRight = qtX + boxW - innerPad;

        // drawQtBasicElements: textX = expanded ? innerLeft : (hasMedia ? 230 : 100)
        const textX = expanded ? innerLeft : (hasMedia ? 230 : 100);
        const wrapWidth = Math.max(1, innerRight - textX);

        const lines = getWrappedText(ctx, text, wrapWidth, { preserveEmptyLines: true });
        const descHeight = lines.length * lineHeight;

        if (DEBUG) {
            console.debug(`${TAG} ───────────────────────────────────────────`);
            console.debug(`${TAG} flags: expanded=${expanded} hasMedia=${hasMedia}`);
            console.debug(`${TAG} geom: innerLeft=${innerLeft} innerRight=${innerRight} textX=${textX} wrapWidth=${wrapWidth}`);
            console.debug(`${TAG} text: lines=${lines.length} lineHeight=${lineHeight} descHeight=${descHeight}`);
        }

        if (expanded && qtMetadata._expandedMediaHeight) {
            const total =
                HEADER + descHeight + 20 +
                qtMetadata._expandedMediaHeight +
                bottomPadding + MARGIN_BOTTOM;

            DEBUG && console.debug(
                `${TAG} [expanded] parts: HEADER=${HEADER} desc=${descHeight} gap=20 media=${qtMetadata._expandedMediaHeight} bottomPad=${bottomPadding} marginBottom=${MARGIN_BOTTOM} => total=${total}`
            );
            DEBUG && console.debug(`${TAG} ───────────────────────────────────────────`);
            return total;
        }

        const COMPACT_MIN_WITH_MEDIA = 285;
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
 */
function measureQtTextNeed(ctx, fontChain, qtMetadata, { expandQtMedia = false } = {}) {
    if (!qtMetadata) return 0;

    const qtX = 20;
    const boxW = 560;
    const innerPad = 20;
    const innerLeft = qtX + innerPad;
    const innerRight = qtX + boxW - innerPad;

    const qtHasMedia = Array.isArray(qtMetadata.mediaExtended) && qtMetadata.mediaExtended.length > 0;
    const textX = expandQtMedia ? innerLeft : (qtHasMedia ? 230 : 100);
    const wrapWidth = Math.max(1, innerRight - textX);

    ctx.font = `24px ${fontChain}`;

    const desc = qtMetadata.error ? (qtMetadata.message || '') : (qtMetadata.description || '');
    const qtLines = getWrappedText(ctx, desc, wrapWidth, { preserveEmptyLines: true });

    const LINE_H = 30;
    const HEADER = 100;
    const bottomPadding = 30;
    const MARGIN_BOTTOM = 8;

    const textHeight = qtLines.length * LINE_H;
    return HEADER + textHeight + bottomPadding + MARGIN_BOTTOM;
}

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
            qtExpandedMediaSize = scaleDownToFitAspectRatio(size, 420, 520);
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
        const minExpanded = (qtMetadata._expandedMediaHeight ?? 0) + 150;
        minByMedia = Math.max(minByMedia, minExpanded);
    } else if (qtHasAny) {
        minByMedia = Math.max(minByMedia, 285);
    }

    // 2) Text-needed height
    const textNeed = measureQtTextNeed(ctx, fontChain, qtMetadata, { expandQtMedia });

    // 3) Final
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
