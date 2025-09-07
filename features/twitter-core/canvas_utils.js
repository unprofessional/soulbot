// Refactored: features/twitter-core/canvas_utils.js

const { cropSingleImage } = require("../twitter-post/crop_single_image");
const { formatTwitterDate, filterMediaUrls } = require("./utils");
const { scaleDownToFitAspectRatio } = require("../twitter-post/scale_down");

/**
 * Wraps text into lines that fit within maxWidth, excluding t.co URLs.
 */
function getWrappedText(ctx, text, maxWidth) {
    const lines = [];
    const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/g;

    text.split('\n').forEach(paragraph => {
        const cleaned = paragraph.replace(shortTwitterUrlPattern, '').trim();
        // if (!cleaned) return lines.push('');
        if (!cleaned) return;

        const words = cleaned.split(' ');
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const testLine = `${currentLine} ${words[i]}`;
            const width = ctx.measureText(testLine).width;
            currentLine = width < maxWidth ? testLine : (lines.push(currentLine), words[i]);
        }
        lines.push(currentLine);
    });

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
    const { yOffset = 0, canvasHeightOffset = 0, hasImgs = false, hasVids = false } = options;

    ctx.drawImage(favicon, 550, 20, 32, 32);
    ctx.textDrawingMode = "glyph";

    ctx.fillStyle = 'white';
    ctx.font = '18px "Noto Color Emoji"';
    ctx.fillText(metadata.authorUsername, 100, 40);

    ctx.fillStyle = 'gray';
    ctx.font = `18px ${font}`;
    ctx.fillText(`@${metadata.authorNick}`, 100, 60);

    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    const descX = (!hasImgs && hasVids) ? 80 : 30;
    drawDescription(ctx, hasImgs, hasVids, descLines, font, descX, yOffset);

    ctx.fillStyle = 'gray';
    ctx.font = `18px ${font}`;
    ctx.fillText(formatTwitterDate(metadata.date), 30, canvasHeightOffset - 20);

    ctx.save();
    const radius = 25;
    ctx.beginPath();
    ctx.arc(20 + radius, 20 + radius, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(pfp, 20, 20, 50, 50);
    ctx.restore();
}

function drawQtBasicElements(ctx, font, metadata, pfp, mediaObj, options) {
    const TAG = '[qt/drawBasic]';

    const {
        canvasHeightOffset = 0,
        qtCanvasHeightOffset = 0,
        expandQtMedia = false,
        expandedMediaSize = null,
    } = options || {};

    const hasImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length > 0;
    const hasVids = filterMediaUrls(metadata, ['mp4']).length > 0;
    const hasMedia = hasImgs || hasVids;

    const qtMaxCharLength = expandQtMedia ? 520 : (hasMedia ? 320 : 420);

    // Quote box geometry
    const qtX = 20;
    const qtY = canvasHeightOffset;
    const boxW = 560;
    const innerPad = 20;                         // inner content padding inside the rounded box
    const innerLeft = qtX + innerPad;            // 40
    const innerRight = qtX + boxW - innerPad;    // 560
    const innerW = innerRight - innerLeft;       // 520

    // Total height is precomputed upstream; ensure it's large enough for our content
    let boxHeight = hasMedia || expandQtMedia
        ? Math.max(qtCanvasHeightOffset, expandQtMedia ? ((metadata._expandedMediaHeight ?? 0) + 150) : 285)
        : qtCanvasHeightOffset;

    // Log helpers
    const safeNum = (n) => (Number.isFinite(n) ? n : 'n/a');
    const logRect = (label, x, y, w, h, extra = '') =>
        console.debug(`${TAG} ${label}: x=${safeNum(x)}, y=${safeNum(y)}, w=${safeNum(w)}, h=${safeNum(h)}${extra ? ' ' + extra : ''}`);

    try {
        console.debug(`${TAG} ─────────────────────────────────────────────────────────`);
        console.debug(`${TAG} options:`, {
            canvasHeightOffset,
            qtCanvasHeightOffset,
            expandQtMedia,
            expandedMediaSize,
        });
        console.debug(`${TAG} media flags: hasImgs=${hasImgs}, hasVids=${hasVids}, hasMedia=${hasMedia}`);
        console.debug(`${TAG} wrap width (chars→px via ctx.font measure): qtMaxCharLength=${qtMaxCharLength}`);

        // Text setup + wrap
        ctx.font = `24px ${font}`;
        const qtDescLines = getWrappedText(ctx, metadata.description ?? '', qtMaxCharLength);
        const lineHeight = 30;

        // Outer box (stroke only)
        ctx.strokeStyle = '#4d4d4d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(qtX, qtY, boxW, boxHeight - 20, 15);
        ctx.stroke();

        logRect('Outer rounded box', qtX, qtY, boxW, boxHeight - 20, 'r=15');
        console.debug(`${TAG} innerPad=${innerPad}, innerLeft=${innerLeft}, innerRight=${innerRight}, innerW=${innerW}`);

        // Names
        ctx.fillStyle = 'white';
        ctx.font = `bold 18px ${font}`;
        ctx.fillText(metadata.authorUsername ?? '', 100, qtY + 40);

        ctx.fillStyle = 'gray';
        ctx.font = `18px ${font}`;
        ctx.fillText(`@${metadata.authorNick ?? ''}`, 100, qtY + 60);

        // --- Text block (drawDescription offsets QT text by +100) ---
        const textX = expandQtMedia ? innerLeft : (hasMedia ? 230 : 100);
        const textTopY = qtY + 100;
        const textLines = qtDescLines.length;
        const textHeight = textLines * lineHeight;
        const textBottomY = textTopY + textHeight;

        const MARGIN_BOTTOM = 8;
        const bottomPadding = 30;
        // Ensure the outer rounded box encloses the last text line + padding
        const neededForText = (textBottomY + bottomPadding + MARGIN_BOTTOM) - qtY;
        if (neededForText > boxHeight) {
            boxHeight = neededForText;
        }

        console.debug(`${TAG} text: lines=${textLines}, lineHeight=${lineHeight}, textHeight=${textHeight}`);
        console.debug(`${TAG} text positions: textX=${textX}, textTopY=${textTopY}, textBottomY=${textBottomY}`);

        ctx.fillStyle = 'white';
        ctx.font = `24px ${font}`;
        drawDescription(ctx, hasImgs, hasVids, qtDescLines, font, textX, qtY, true);

        // Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(65, canvasHeightOffset + 45, 25, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(pfp, 40, canvasHeightOffset + 20, 50, 50);
        ctx.restore();
        logRect('Avatar draw', 40, canvasHeightOffset + 20, 50, 50, '(clip: circle r=25 @ (65, ' + (canvasHeightOffset + 45) + '))');

        // --- Media ---
        if (mediaObj) {
            // Natural source dimensions (from Image object)
            const srcW = Number(mediaObj.width) || Number(mediaObj.videoWidth) || null;
            const srcH = Number(mediaObj.height) || Number(mediaObj.videoHeight) || null;
            console.debug(`${TAG} media source natural size: ${safeNum(srcW)} x ${safeNum(srcH)}`);

            ctx.save();
            ctx.beginPath();

            if (expandQtMedia && expandedMediaSize) {
                // Inner content margins so corners stay visible
                const MARGIN_X = 3;       // left/right inside the quote box
                const MARGIN_BOTTOM = 8;  // bottom inside the quote box (keep in sync with calc)
                const maxInnerW = innerW - MARGIN_X * 2;

                // Start with proposed expanded size, clamp to bounds
                let targetW = Math.min(maxInnerW, Math.round(expandedMediaSize.width || maxInnerW));
                let targetH = Math.min(420, Math.round(expandedMediaSize.height || 320));

                // Center within inner content area (beneath text)
                let mediaX = innerLeft + Math.round((innerW - targetW) / 2);
                let mediaY = Math.round(textBottomY + 20);

                const boxBottom = qtY + (boxHeight - 20) - innerPad - MARGIN_BOTTOM;
                const willOverflow = mediaY + targetH >= boxBottom;

                console.debug(`${TAG} [expanded] innerW=${innerW} maxInnerW=${maxInnerW} MARGIN_X=${MARGIN_X} MARGIN_BOTTOM=${MARGIN_BOTTOM}`);
                console.debug(`${TAG} [expanded] proposed target size: ${targetW} x ${targetH}`);
                console.debug(`${TAG} [expanded] media position: x=${mediaX}, y=${mediaY}`);
                console.debug(`${TAG} [expanded] boxBottom=${boxBottom}, willOverflow=${willOverflow}`);

                if (willOverflow) {
                    const availH = Math.max(1, boxBottom - mediaY);
                    const scale = availH / targetH;
                    const scaledW = Math.floor(targetW * scale);
                    const scaledH = Math.floor(targetH * scale);

                    console.debug(`${TAG} [expanded] overflow adjust: availH=${availH}, scale=${scale.toFixed(4)} => new target ${scaledW} x ${scaledH}`);

                    targetW = scaledW;
                    targetH = scaledH;
                    mediaX = innerLeft + Math.round((innerW - targetW) / 2);
                }

                // Clip slightly inside to avoid anti-alias “shaving”
                const clipInset = 0.5;
                const r = Math.max(8, Math.min(15, Math.floor(Math.min(targetW, targetH) * 0.08)));
                const clipX = mediaX + clipInset;
                const clipY = mediaY + clipInset;
                const clipW = targetW - 2 * clipInset;
                const clipH = targetH - 2 * clipInset;

                logRect('[expanded] FINAL target draw', mediaX, mediaY, targetW, targetH);
                logRect('[expanded] CLIP rounded-rect', clipX, clipY, clipW, clipH, `r=${r} (inset=${clipInset})`);

                ctx.roundRect(clipX, clipY, clipW, clipH, r);
                ctx.clip();

                try {
                    console.debug(`${TAG} [expanded] cropSingleImage(src: ${safeNum(srcW)}x${safeNum(srcH)} → dst: ${targetW}x${targetH} @ ${mediaX},${mediaY})`);
                    cropSingleImage(ctx, mediaObj, targetW, targetH, mediaX, mediaY, {
                        tag: 'qt/expanded',
                        debugOverlay: process.env.DEBUG_QT === '1'
                    });
                } catch (err) {
                    console.warn(`${TAG} [expanded] cropSingleImage ERROR:`, err);
                }
            } else {
                // Compact left thumbnail
                const thumbW = 175, thumbH = 175;
                const thumbX = innerLeft;
                const thumbY = canvasHeightOffset + 80;
                const r = 15, clipInset = 1;

                logRect('[thumb] target draw', thumbX, thumbY, thumbW, thumbH);
                logRect('[thumb] CLIP rounded-rect', thumbX + clipInset, thumbY + clipInset, thumbW - 2 * clipInset, thumbH - 2 * clipInset, `r=${r} (inset=${clipInset})`);

                ctx.roundRect(thumbX + clipInset, thumbY + clipInset, thumbW - 2 * clipInset, thumbH - 2 * clipInset, r);
                ctx.clip();

                try {
                    console.debug(`${TAG} [thumb] cropSingleImage(src: ${safeNum(srcW)}x${safeNum(srcH)} → dst: ${thumbW}x${thumbH} @ ${thumbX},${thumbY})`);
                    cropSingleImage(ctx, mediaObj, thumbW, thumbH, thumbX, thumbY);
                } catch (err) {
                    console.warn(`${TAG} [thumb] cropSingleImage ERROR:`, err);
                }
            }

            ctx.restore();
        }

        console.debug(`${TAG} DONE (boxHeight=${boxHeight}, innerPad=${innerPad}, font=${font})`);
        console.debug(`${TAG} ─────────────────────────────────────────────────────────`);
    } catch (e) {
        console.warn(`${TAG} ERROR during draw:`, e);
    }
}

function drawQtMissingStatus(ctx, font, errorMsg, options) {
    const { canvasHeightOffset = 0, qtCanvasHeightOffset = 0 } = options;
    ctx.font = `24px ${font}`;
    const qtDescLines = getWrappedText(ctx, errorMsg, 420);

    const qtX = 20;
    const qtY = canvasHeightOffset;
    ctx.strokeStyle = '#4d4d4d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(qtX, qtY, 560, qtCanvasHeightOffset - 20, 15);
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

    // === Left: Avatar + User Info ===
    ctx.save();
    const avatarRadius = 30;
    const avatarX = padding + avatarRadius;
    const avatarY = yOffset;

    ctx.beginPath();
    ctx.arc(avatarX, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(pfp, avatarX - avatarRadius, avatarY, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.font = `bold 18px ${font}`;
    ctx.fillText(metadata.authorUsername, padding, avatarY + avatarRadius * 2 + 30);

    ctx.fillStyle = 'gray';
    ctx.font = `18px ${font}`;
    ctx.fillText(`@${metadata.authorNick}`, padding, avatarY + avatarRadius * 2 + 55);

    // === Right: Wrapped Description ===
    const textX = hasMedia ? (padding + leftColumnWidth) : padding;
    const textY = yOffset + 100;

    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    drawDescription(ctx, hasImgs, hasVids, descLines, font, textX, textY);

    // === Footer Date ===
    const footerY = canvasHeightOffset - 20;
    ctx.fillStyle = 'gray';
    ctx.font = `18px ${font}`;
    ctx.fillText(formatTwitterDate(metadata.date), padding, footerY);

    // === Favicon Top Right ===
    ctx.drawImage(favicon, 550, 20, 32, 32);
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
