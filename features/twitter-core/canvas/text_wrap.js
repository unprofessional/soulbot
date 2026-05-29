// features/twitter-core/canvas/text_wrap.js

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
            if (preserveEmptyLines) lines.push('');
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
 * Thread bubble wrapper (existing logic kept intact).
 */
function threadBubbleWrapText(ctx, text, maxWidth, maxLines = 4) {
    const lines = [];
    const rawLines = text.split('\n');

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
    threadBubbleWrapText,
};
