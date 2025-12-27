/* eslint-disable no-empty */
// features/twitter-core/canvas/qt_draw.js

const { cropSingleImage } = require('../../twitter-post/crop_single_image');
const { getWrappedText } = require('./text_wrap');
const { drawDescriptionLines } = require('./misc_draw');
const { QT, getQtInnerRect, getQtTextX, getQtWrapWidth } = require('../layout/geometry');
const { filterMediaUrls } = require('../utils');

function drawQtBasicElements(ctx, fontChain, metadata, pfp, mediaObj, options) {
    const DEBUG = true;
    const TAG = '[qt/drawBasic]';

    const {
        canvasHeightOffset = 0,
        qtCanvasHeightOffset = 0,
        expandQtMedia = false,
        expandedMediaSize = null,
    } = options || {};

    const OUTER_STROKE_W = 1;
    const EXTRA_BOTTOM_PAD = 2;

    // Robust QT media check: if we were handed an image, QT has media
    const qtHasMedia = Boolean(mediaObj);

    // Quote box geometry
    const qtX = QT.x;
    const qtY = canvasHeightOffset;
    const boxW = QT.w;

    const { innerLeft, innerRight, innerW } = getQtInnerRect();

    // Base height: respect the provided authoritative height but preserve old min rules
    let boxHeight = (qtHasMedia || expandQtMedia)
        ? Math.max(
            qtCanvasHeightOffset,
            expandQtMedia ? ((metadata._expandedMediaHeight ?? 0) + 150) : QT.compactMinWithMedia
        )
        : qtCanvasHeightOffset;

    const safeNum = (n) => (Number.isFinite(n) ? n : 'n/a');
    const logRect = (label, x, y, w, h, extra = '') =>
        DEBUG && console.debug(`${TAG} ${label}: x=${safeNum(x)}, y=${safeNum(y)}, w=${safeNum(w)}, h=${safeNum(h)}${extra ? ' ' + extra : ''}`);

    try {
        const textX = getQtTextX({ expandQtMedia, qtHasMedia });
        const wrapWidth = getQtWrapWidth({ expandQtMedia, qtHasMedia });

        const LINE_H = QT.lineH;

        ctx.font = `24px ${fontChain}`;
        const desc = metadata.error ? (metadata.message || '') : (metadata.description || '');
        const qtLines = getWrappedText(ctx, desc, wrapWidth, { preserveEmptyLines: true });

        const textTopY = qtY + QT.headerH;
        const textHeight = qtLines.length * LINE_H;
        const textBottomY = textTopY + textHeight;

        // Clamp box height so text always fits
        const neededForText =
            (QT.headerH + textHeight + QT.bottomPad + QT.marginBottom); // height needed from top of box
        if (neededForText > boxHeight) boxHeight = neededForText;

        // Account for stroke/padding safety
        boxHeight = Math.ceil(boxHeight + OUTER_STROKE_W + EXTRA_BOTTOM_PAD);

        DEBUG && console.debug(`${TAG} media: qtHasMedia=${qtHasMedia} expandQtMedia=${expandQtMedia}`);
        DEBUG && console.debug(`${TAG} wrap: textX=${textX} wrapWidth=${wrapWidth} innerRight=${innerRight}`);
        DEBUG && console.debug(`${TAG} text: lines=${qtLines.length} LINE_H=${LINE_H} top=${textTopY} bottom=${textBottomY} boxH=${boxHeight}`);

        // Outer rounded box
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(qtX, qtY, boxW, boxHeight, 15);
        ctx.fillStyle = '#0f0f10';
        ctx.fill();
        ctx.strokeStyle = '#4d4d4d';
        ctx.lineWidth = OUTER_STROKE_W;
        ctx.stroke();
        ctx.restore();

        // Names
        ctx.fillStyle = 'white';
        ctx.font = `bold 18px ${fontChain}`;
        ctx.fillText(metadata.authorUsername ?? '', 100, qtY + 40);

        ctx.fillStyle = 'gray';
        ctx.font = `18px ${fontChain}`;
        ctx.fillText(`@${metadata.authorNick ?? ''}`, 100, qtY + 60);

        // Avatar
        if (pfp) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(65, qtY + 45, 25, 0, Math.PI * 2);
            ctx.clip();
            try { ctx.drawImage(pfp, 40, qtY + 20, 50, 50); } catch {}
            ctx.restore();
            logRect('Avatar', 40, qtY + 20, 50, 50);
        }

        // Compact thumbnail (left) when NOT expanded and QT has media
        if (!expandQtMedia && qtHasMedia) {
            const thumbW = 175, thumbH = 175;
            const thumbX = innerLeft; // 40
            const thumbY = qtY + 80;  // under header
            const r = 15, inset = 1;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(thumbX + inset, thumbY + inset, thumbW - 2 * inset, thumbH - 2 * inset, r);
            ctx.clip();
            try {
                cropSingleImage(ctx, mediaObj, thumbW, thumbH, thumbX, thumbY);
            } catch (e) {
                console.warn(`${TAG} [thumb] cropSingleImage ERROR:`, e);
            }
            ctx.restore();

            logRect('[thumb] drawn', thumbX, thumbY, thumbW, thumbH);
        }

        // QT text (draw at exact textX)
        ctx.fillStyle = 'white';
        ctx.font = `24px ${fontChain}`;
        drawDescriptionLines(ctx, qtLines, textX, textTopY, { lineHeight: LINE_H });

        // Expanded media (big image under text)
        if (expandQtMedia && qtHasMedia && expandedMediaSize && expandedMediaSize.width && expandedMediaSize.height) {
            const GAP = 20;
            const maxInnerW = innerW - 6;

            let w = Math.min(maxInnerW, Math.round(expandedMediaSize.width));
            let h = Math.min(420, Math.round(expandedMediaSize.height));

            let mediaX = innerLeft + Math.round((innerW - w) / 2);
            let mediaY = Math.round(textBottomY + GAP);

            // Ensure it fits inside box
            const boxBottom = qtY + boxHeight - QT.innerPad - QT.marginBottom;
            if (mediaY + h > boxBottom) {
                const availH = Math.max(1, boxBottom - mediaY);
                const scale = availH / h;
                w = Math.floor(w * scale);
                h = Math.floor(availH);
                mediaX = innerLeft + Math.round((innerW - w) / 2);
            }

            ctx.save();
            const r = Math.max(8, Math.min(15, Math.floor(Math.min(w, h) * 0.08)));
            ctx.beginPath();
            ctx.roundRect(mediaX + 0.5, mediaY + 0.5, w - 1, h - 1, r);
            ctx.clip();
            try {
                cropSingleImage(ctx, mediaObj, w, h, mediaX, mediaY, { tag: 'qt/expanded', debugOverlay: DEBUG });
            } catch (e) {
                console.warn(`${TAG} [expanded] cropSingleImage ERROR:`, e);
            }
            ctx.restore();

            // Border
            ctx.save();
            ctx.strokeStyle = '#4d4d4d';
            ctx.lineWidth = 2;
            ctx.strokeRect(mediaX, mediaY, w, h);
            ctx.restore();

            logRect('[expanded] drawn', mediaX, mediaY, w, h);
        }

        DEBUG && console.debug(`${TAG} SUMMARY: { textX:${textX}, wrap:${wrapWidth}, top:${textTopY}, bottom:${textBottomY}, boxH:${boxHeight} }`);
    } catch (e) {
        console.warn(`${TAG} ERROR during draw:`, e);
    }
}

function drawQtMissingStatus(ctx, fontChain, errorMsg, options) {
    const { canvasHeightOffset = 0, qtCanvasHeightOffset = 0 } = options;

    ctx.font = `24px ${fontChain}`;

    // matches no-media wrap width: innerRight - textX(=100)
    const wrapWidth = getQtWrapWidth({ expandQtMedia: false, qtHasMedia: false });
    const qtDescLines = getWrappedText(ctx, errorMsg, wrapWidth, { preserveEmptyLines: true });

    const qtX = QT.x;
    const qtY = canvasHeightOffset;

    ctx.strokeStyle = '#4d4d4d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(qtX, qtY, QT.w, qtCanvasHeightOffset, 15);
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = `24px ${fontChain}`;
    // historically you were drawing with a header offset hack; keep the same visible positioning
    drawDescriptionLines(ctx, qtDescLines, QT.textXNoMedia, qtY + 60, { lineHeight: QT.lineH });
}

function drawQtDesktopLayout(ctx, fontChain, metadata, pfp, mediaObj, options) {
    const { canvasHeightOffset = 0, qtCanvasHeightOffset = 0 } = options;

    const padding = 30;
    const leftColWidth = 150;

    const hasImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length > 0;
    const hasVids = filterMediaUrls(metadata, ['mp4']).length > 0;
    const hasMedia = hasImgs || hasVids;

    const textWrapWidth = hasMedia ? 320 : 420;
    ctx.font = `24px ${fontChain}`;
    const qtDescLines = getWrappedText(ctx, metadata.description, textWrapWidth, { preserveEmptyLines: true });

    const qtX = QT.x;
    const qtY = canvasHeightOffset;
    const boxHeight = Math.max(qtCanvasHeightOffset, hasMedia ? QT.compactMinWithMedia : 150);

    ctx.strokeStyle = '#4d4d4d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(qtX, qtY, QT.w, boxHeight - 20, 15);
    ctx.stroke();

    const avatarRadius = 25;
    const avatarX = qtX + padding;
    const avatarY = qtY + 20;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
    ctx.clip();
    try { ctx.drawImage(pfp, avatarX, avatarY, avatarRadius * 2, avatarRadius * 2); } catch {}
    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.font = `bold 18px ${fontChain}`;
    ctx.fillText(metadata.authorUsername, avatarX, avatarY + avatarRadius * 2 + 20);

    ctx.fillStyle = 'gray';
    ctx.font = `18px ${fontChain}`;
    ctx.fillText(`@${metadata.authorNick}`, avatarX, avatarY + avatarRadius * 2 + 40);

    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    const textX = hasMedia ? (qtX + leftColWidth) : (qtX + padding);
    const textY = qtY + 30;
    drawDescriptionLines(ctx, qtDescLines, textX, textY + 70, { lineHeight: QT.lineH }); // keep your legacy isQt offset feel

    if (mediaObj) {
        const mediaY = qtY + boxHeight - 195;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(qtX + padding, mediaY, 175, 175, 15);
        ctx.clip();
        cropSingleImage(ctx, mediaObj, 175, 175, qtX + padding, mediaY);
        ctx.restore();
    }
}

module.exports = {
    drawQtBasicElements,
    drawQtMissingStatus,
    drawQtDesktopLayout,
};
