/* eslint-disable no-empty */
// Refactored: features/twitter-core/canvas_utils.js

const { cropSingleImage } = require("../twitter-post/crop_single_image");
const { formatTwitterDate, filterMediaUrls, formatTwitterFooter } = require("./utils");
const { scaleDownToFitAspectRatio } = require("../twitter-post/scale_down");

/**
 * Wraps text into lines that fit within maxWidth, excluding t.co URLs.
 */
function getWrappedText(ctx, text, maxWidthPx, { preserveEmptyLines = true } = {}) {
    const lines = [];
    const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/g;

    const paragraphs = String(text ?? '').split('\n');

    for (const paragraph of paragraphs) {
        const cleaned = paragraph.replace(shortTwitterUrlPattern, '').trim();

        if (!cleaned) {
            if (preserveEmptyLines) lines.push(''); // keep vertical rhythm for blank lines
            continue;
        }

        const words = cleaned.split(/\s+/);
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const testLine = `${currentLine} ${words[i]}`;
            const width = ctx.measureText(testLine).width;
            if (width < maxWidthPx) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = words[i];
            }
        }
        lines.push(currentLine);
    }

    return lines;
}


/**
 * Calculates y position based on line height.
 */
function getYPosFromLineHeight(descLines, y, lineHeight = 30) {
    return y + descLines.length * lineHeight;
}

/**
 * Draws wrapped text description lines.
 */
function drawDescription(ctx, hasImgs, hasVids, descLines, font, x, y, isQt = false) {
    const lineHeight = 30;
    ctx.font = '24px "Noto Color Emoji"';
    ctx.textDrawingMode = "glyph";

    descLines.forEach(line => {
        ctx.fillText(line, x, isQt ? y + 100 : y);
        y += lineHeight;
    });
}

/**
 * Renders individual letters with spacing.
 */
function drawTextWithSpacing(ctx, text, x, y, letterSpacing = 1) {
    let currentX = x;
    for (const char of text) {
        ctx.fillText(char, currentX, y);
        currentX += ctx.measureText(char).width + letterSpacing;
    }
}

function drawBasicElements(ctx, font, metadata, favicon, pfp, descLines, options) {
    const { yOffset = 0, canvasHeightOffset = 0, hasImgs = false, hasVids = false, footerY } = options;

    // Top-right icon
    if (favicon) {
        try { ctx.drawImage(favicon, 550, 20, 32, 32); } catch {}
    }

    ctx.textDrawingMode = "glyph";

    // Display name
    ctx.fillStyle = 'white';
    ctx.font = '18px "Noto Color Emoji"';
    ctx.fillText(String(metadata.authorUsername || ''), 100, 40);

    // Handle
    ctx.fillStyle = 'gray';
    ctx.font = `18px ${font}`;
    ctx.fillText(`@${String(metadata.authorNick || '')}`, 100, 60);

    // Body text
    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    const descX = (!hasImgs && hasVids) ? 80 : 30;
    drawDescription(ctx, hasImgs, hasVids, descLines, font, descX, yOffset);

    // Footer timestamp — "3:58 PM Eastern · Sep 10, 2025"
    const footerStr = metadata._displayDateFooter || formatTwitterFooter(metadata, { label: 'canvas.basic/footer' });

    // If footerY provided, use it; otherwise keep legacy behavior
    const resolvedFooterY = Number.isFinite(footerY)
        ? footerY
        : Math.max(0, canvasHeightOffset - 20);

    if (footerStr) {
        ctx.fillStyle = 'gray';
        ctx.font = `18px ${font}`;
        ctx.fillText(footerStr, 30, resolvedFooterY);
    }

    // Avatar
    if (pfp) {
        ctx.save();
        const radius = 25;
        ctx.beginPath();
        ctx.arc(20 + radius, 20 + radius, radius, 0, Math.PI * 2);
        ctx.clip();
        try { ctx.drawImage(pfp, 20, 20, 50, 50); } catch {}
        ctx.restore();
    }
}

function drawQtBasicElements(ctx, font, metadata, pfp, mediaObj, options) {
    const DEBUG = true;
    const TAG = '[qt/drawBasic]';

    const {
        canvasHeightOffset = 0,
        qtCanvasHeightOffset = 0,
        expandQtMedia = false,
        expandedMediaSize = null,
    } = options || {};

    const OUTER_STROKE_W = 1;     // rounded box stroke
    const EXTRA_BOTTOM_PAD = 2;   // safety so corners never hit canvas edge

    // Robust QT media check: if we were handed an image, QT has media
    const qtHasMedia = Boolean(mediaObj);

    // Quote box geometry
    const qtX = 20;
    const qtY = canvasHeightOffset;
    const boxW = 560;
    const innerPad = 20;
    const innerLeft = qtX + innerPad;            // 40
    const innerRight = qtX + boxW - innerPad;    // 560
    const innerW = innerRight - innerLeft;       // 520

    // Use calc height but allow clamp up if text needs it
    let boxHeight = (qtHasMedia || expandQtMedia)
        ? Math.max(
            qtCanvasHeightOffset,
            expandQtMedia ? ((metadata._expandedMediaHeight ?? 0) + 150) : 285
        )
        : qtCanvasHeightOffset;

    const safeNum = (n) => (Number.isFinite(n) ? n : 'n/a');
    const logRect = (label, x, y, w, h, extra = '') =>
        DEBUG && console.debug(`${TAG} ${label}: x=${safeNum(x)}, y=${safeNum(y)}, w=${safeNum(w)}, h=${safeNum(h)}${extra ? ' ' + extra : ''}`);

    try {
    // textX logic MUST mirror calculateQuoteHeight:
    // expanded? left margin; else if QT has media -> 230 (thumb left), else 100
        const textX = expandQtMedia ? innerLeft : (qtHasMedia ? 230 : 100);
        const wrapWidth = Math.max(1, innerRight - textX); // 520 / 330 / 460

        // Measure QT description with the same font used to draw
        const LINE_H = 30;
        ctx.font = `24px ${font}`;
        const desc = metadata.error ? (metadata.message || '') : (metadata.description || '');
        const qtLines = getWrappedText(ctx, desc, Math.max(1, (20 + 560 - 20) - (expandQtMedia ? 40 : (mediaObj ? 230 : 100)))); // keep same wrap math

        // Text block starts at HEADER = 100
        const textTopY = qtY + 100;
        const textHeight = qtLines.length * LINE_H;
        const textBottomY = textTopY + textHeight;

        // Clamp box height so text always fits
        const MARGIN_BOTTOM = 8;
        const bottomPadding = 30;
        const neededForText = (textTopY + textHeight + bottomPadding + MARGIN_BOTTOM) - canvasHeightOffset;
        if (neededForText > boxHeight) boxHeight = neededForText;

        boxHeight = Math.ceil(boxHeight + OUTER_STROKE_W + EXTRA_BOTTOM_PAD);



        DEBUG && console.debug(`${TAG} media: qtHasMedia=${qtHasMedia} expandQtMedia=${expandQtMedia}`);
        DEBUG && console.debug(`${TAG} wrap: textX=${textX} wrapWidth=${wrapWidth}`);
        DEBUG && console.debug(`${TAG} text: lines=${qtLines.length} LINE_H=${LINE_H} top=${textTopY} bottom=${textBottomY} boxH=${boxHeight}`);

        // --- Outer rounded box (fill + stroke)
        // ctx.save();
        // ctx.beginPath();
        // ctx.roundRect(qtX, qtY, boxW, boxHeight, 15);
        // ctx.fillStyle = '#0f0f10';
        // ctx.fill();
        // ctx.strokeStyle = '#4d4d4d';
        // ctx.lineWidth = 1;
        // ctx.stroke();
        // ctx.restore();
        // logRect('Outer rounded box', qtX, qtY, boxW, boxHeight, 'r=15');

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(20, canvasHeightOffset, 560, boxHeight, 15);
        ctx.fillStyle = '#0f0f10';
        ctx.fill();
        ctx.strokeStyle = '#4d4d4d';
        ctx.lineWidth = OUTER_STROKE_W;
        ctx.stroke();
        ctx.restore();

        // --- Names
        ctx.fillStyle = 'white';
        ctx.font = `bold 18px ${font}`;
        ctx.fillText(metadata.authorUsername ?? '', 100, qtY + 40);

        ctx.fillStyle = 'gray';
        ctx.font = `18px ${font}`;
        ctx.fillText(`@${metadata.authorNick ?? ''}`, 100, qtY + 60);

        // --- Avatar
        if (pfp) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(65, qtY + 45, 25, 0, Math.PI * 2);
            ctx.clip();
            try { ctx.drawImage(pfp, 40, qtY + 20, 50, 50); } catch {}
            ctx.restore();
            logRect('Avatar', 40, qtY + 20, 50, 50);
        }

        // --- Compact thumbnail (left) when NOT expanded and QT has media
        if (!expandQtMedia && qtHasMedia) {
            const thumbW = 175, thumbH = 175;
            const thumbX = innerLeft;       // 40
            const thumbY = qtY + 80;        // just under header
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

        // --- QT text (draw manually so x is EXACTLY textX)
        ctx.fillStyle = 'white';
        ctx.font = `24px ${font}`;
        for (let i = 0; i < qtLines.length; i++) {
            ctx.fillText(qtLines[i], textX, textTopY + i * LINE_H);
        }

        // --- Expanded media (big image under text)
        if (expandQtMedia && qtHasMedia && expandedMediaSize && expandedMediaSize.width && expandedMediaSize.height) {
            const GAP = 20;
            const maxInnerW = innerW - 6; // small side margins
            let w = Math.min(maxInnerW, Math.round(expandedMediaSize.width));
            let h = Math.min(420, Math.round(expandedMediaSize.height));

            let mediaX = innerLeft + Math.round((innerW - w) / 2);
            let mediaY = Math.round(textBottomY + GAP);

            // Ensure it fits inside box
            const boxBottom = qtY + boxHeight - innerPad - MARGIN_BOTTOM;
            if (mediaY + h > boxBottom) {
                const availH = Math.max(1, boxBottom - mediaY);
                const scale = availH / h;
                w = Math.floor(w * scale);
                h = Math.floor(availH);
                mediaX = innerLeft + Math.round((innerW - w) / 2);
            }

            // Rounded clip + draw
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

function drawQtMissingStatus(ctx, font, errorMsg, options) {
    const { canvasHeightOffset = 0, qtCanvasHeightOffset = 0 } = options;
    ctx.font = `24px ${font}`;
    const qtDescLines = getWrappedText(ctx, errorMsg, 460); // matches no-media text width (560 - 100)

    const qtX = 20;
    const qtY = canvasHeightOffset;
    ctx.strokeStyle = '#4d4d4d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Use full height (no -20 shrink)
    ctx.roundRect(qtX, qtY, 560, qtCanvasHeightOffset, 15);
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = `24px ${font}`;
    drawDescription(ctx, false, false, qtDescLines, font, 100, qtY - 40, true);
}

function embedCommunityNote(message, noteText) {
    return noteText
        ? {
            color: 0x0099ff,
            title: 'Community Note:',
            description: noteText,
        }
        : undefined;
}

function getAdjustedAspectRatios(canvasWidth, canvasHeight, videoWidth, videoHeight, heightShim) {
    const even = n => Math.ceil(n / 2) * 2;
    const mediaObject = { width: even(videoWidth), height: even(videoHeight) };
    const adjustedCanvasWidth = even(canvasWidth);
    const adjustedCanvasHeight = even(canvasHeight);
    const scaled = scaleDownToFitAspectRatio(mediaObject, adjustedCanvasHeight, adjustedCanvasWidth, canvasHeight - heightShim);

    return {
        adjustedCanvasWidth,
        adjustedCanvasHeight,
        scaledDownObjectWidth: scaled.width,
        scaledDownObjectHeight: scaled.height,
        overlayX: (canvasWidth - scaled.width) / 2,
        overlayY: canvasHeight - heightShim - 50,
    };
}

function drawDesktopLayout(ctx, font, metadata, favicon, pfp, descLines, options) {
    const {
        yOffset = 0,
        canvasHeightOffset = 0,
        hasImgs = false,
        hasVids = false,
    } = options;

    const hasMedia = hasImgs || hasVids;
    const padding = 30;
    const leftColumnWidth = 150;

    ctx.textDrawingMode = "glyph";

    // Left: avatar
    const avatarRadius = 30;
    const avatarX = padding + avatarRadius;
    const avatarY = yOffset;

    if (pfp) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
        ctx.clip();
        try { ctx.drawImage(pfp, avatarX - avatarRadius, avatarY, avatarRadius * 2, avatarRadius * 2); } catch {}
        ctx.restore();
    }

    // Name + handle
    ctx.fillStyle = 'white';
    ctx.font = `bold 18px ${font}`;
    ctx.fillText(String(metadata.authorUsername || ''), padding, avatarY + avatarRadius * 2 + 30);

    ctx.fillStyle = 'gray';
    ctx.font = `18px ${font}`;
    ctx.fillText(`@${String(metadata.authorNick || '')}`, padding, avatarY + avatarRadius * 2 + 55);

    // Description (right column if media, otherwise full width)
    const textX = hasMedia ? (padding + leftColumnWidth) : padding;
    const textY = yOffset + 100;

    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    drawDescription(ctx, hasImgs, hasVids, descLines, font, textX, textY);

    // Footer timestamp
    const footerStr = metadata._displayDateFooter || formatTwitterFooter(metadata, { label: 'canvas.desktop/footer' });
    const footerY = Math.max(0, canvasHeightOffset - 20);

    // NEW: if footerY provided, use it; otherwise keep legacy behavior
    const resolvedFooterY = Number.isFinite(footerY)
        ? footerY
        : Math.max(0, canvasHeightOffset - 20);

    if (footerStr) {
        ctx.fillStyle = 'gray';
        ctx.font = `18px ${font}`;
        ctx.fillText(footerStr, 30, resolvedFooterY);
    }
    

    // Top-right icon
    if (favicon) {
        try { ctx.drawImage(favicon, 550, 20, 32, 32); } catch {}
    }
}

function drawQtDesktopLayout(ctx, font, metadata, pfp, mediaObj, options) {
    const {
        canvasHeightOffset = 0,
        qtCanvasHeightOffset = 0,
    } = options;

    const padding = 30;
    const leftColWidth = 150;

    const hasImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length > 0;
    const hasVids = filterMediaUrls(metadata, ['mp4']).length > 0;
    const hasMedia = hasImgs || hasVids;

    const textWrapWidth = hasMedia ? 320 : 420;
    ctx.font = `24px ${font}`;
    const qtDescLines = getWrappedText(ctx, metadata.description, textWrapWidth);

    const qtX = 20;
    const qtY = canvasHeightOffset;
    const boxHeight = Math.max(qtCanvasHeightOffset, hasMedia ? 285 : 150);

    // === Outer Quote Box ===
    ctx.strokeStyle = '#4d4d4d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(qtX, qtY, 560, boxHeight - 20, 15);
    ctx.stroke();

    // === Left: PFP + Name ===
    const avatarRadius = 25;
    const avatarX = qtX + padding;
    const avatarY = qtY + 20;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(pfp, avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.font = `bold 18px ${font}`;
    ctx.fillText(metadata.authorUsername, avatarX, avatarY + avatarRadius * 2 + 20);

    ctx.fillStyle = 'gray';
    ctx.font = `18px ${font}`;
    ctx.fillText(`@${metadata.authorNick}`, avatarX, avatarY + avatarRadius * 2 + 40);

    // === Right: Wrapped Quote Description ===
    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    const textX = hasMedia ? (qtX + leftColWidth) : (qtX + padding);
    const textY = qtY + 30;
    drawDescription(ctx, hasImgs, hasVids, qtDescLines, font, textX, textY, true);

    // === Optional: Media Preview ===
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

function threadBubbleWrapText(ctx, text, maxWidth, maxLines = 4) {
    const lines = [];
    const rawLines = text.split('\n'); // preserve newlines manually

    for (let i = 0; i < rawLines.length; i++) {
        let rawLine = rawLines[i];

        // Only process @mention stripping on the first non-empty line
        if (i === 0) {
            const mentionRegex = /^(?:@\w+\s*)+/;
            rawLine = rawLine.replace(mentionRegex, '').trimStart();
        }

        const words = rawLine.split(/\s+/);
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (!currentLine) {
                    lines.push(word);
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }

                if (lines.length >= maxLines - 1) break;
            }
        }

        if (currentLine && lines.length < maxLines) {
            lines.push(currentLine);
        }

        if (lines.length >= maxLines) break;
    }

    const totalWordsLength = text.replace(/\s+/g, ' ').trim().length;
    const linesJoinedLength = lines.join(' ').length;

    if (lines.length === maxLines && totalWordsLength > linesJoinedLength) {
        let line = lines[maxLines - 1];
        while (ctx.measureText(line + '…').width > maxWidth && line.length > 0) {
            line = line.slice(0, -1);
        }
        lines[maxLines - 1] = line + '…';
    }

    return lines;
}

module.exports = {
    getWrappedText,
    getYPosFromLineHeight,
    drawDescription,
    drawTextWithSpacing,
    drawBasicElements,
    drawQtBasicElements,
    drawQtMissingStatus,
    embedCommunityNote,
    getAdjustedAspectRatios,
    drawDesktopLayout,
    drawQtDesktopLayout,
    threadBubbleWrapText,
};
