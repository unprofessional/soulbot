const { formatTwitterDate } = require("./utils");

function getWrappedText(ctx, text, maxWidth, hasVids) {
    const lines = [];
    const paragraphs = hasVids
        ? [text.replace(/\n/g, ' ')]
        : text.split('\n'); // Conditionally handle newlines

    const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/g; // Ensure global match

    paragraphs.forEach(paragraph => {
        let matches = paragraph.match(shortTwitterUrlPattern); // Get the URL matches

        if (matches) {
            matches.forEach(url => {
                paragraph = paragraph.replace(url, '').trim();
            });
        }

        if (paragraph === '') {
            lines.push(''); // Handle blank lines (paragraph breaks)
        } else {
            const words = paragraph.split(' ');
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;

                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine); // Push the last line of the paragraph
        }
    });
    return lines;
}

function setFontBasedOnContent(ctx, text) {
    console.log('>>> setFontBasedOnContent reached!');

    // const emojiPattern = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{203C}-\u{3299}]/u;

    console.log('>>> setFontBasedOnContent > text: ', text);

    ctx.textDrawingMode = "glyph";
    ctx.font = '24px "Noto Color Emoji"';

    // if (emojiPattern.test(text)) {
    //     console.log('>>> Emoji detected!');
    //     ctx.textDrawingMode = "glyph";
    //     ctx.font = '24px "Noto Color Emoji"';
    // }
    // else {
    //     console.log('>>> Emoji NOT detected...');
    //     ctx.font = '24px "Noto Color Emoji"';
    // }
}

const drawDescription = (ctx, hasImgs, hasVids, hasOnlyVideos, descLines, font, x, y, isQt) => {
    const lineHeight = hasOnlyVideos ? 50 : 30;
    descLines.forEach(line => {
        if(!hasImgs && hasVids) {
            ctx.font = '36px ' + font;
        } else {
            ctx.textDrawingMode = "glyph";
            ctx.font = '24px "Noto Color Emoji"';
        }
        ctx.fillText(line, x, isQt ? y + 100: y);
        // drawTextWithSpacing(ctx, line, x, y, 1);
        y += lineHeight;
    });
};

function drawTextWithSpacing(ctx, text, x, y, letterSpacing = 1) {
    // Set the initial position
    let currentX = x;

    // Draw each character with specified letter spacing
    for (const char of text) {
        ctx.fillText(char, currentX, y);
        // Move the x position by the character width plus the letterSpacing
        currentX += ctx.measureText(char).width + letterSpacing;
    }
}

const drawBasicElements = (
    ctx, globalFont, metadata, favicon, pfp,
    hasImgs, hasVids, hasOnlyVideos, descLines, defaultYPosition,
    calculatedCanvasHeightFromDescLines
) => {
    // Load and draw favicon
    ctx.drawImage(favicon, 550, 20, 32, 32);

    // Draw nickname elements
    ctx.fillStyle = 'white';
    // ctx.font = 'bold 18px ' + globalFont;
    // setFontBasedOnContent(ctx, metadata.authorUsername);
    ctx.textDrawingMode = "glyph";
    ctx.font = '18px "Noto Color Emoji"';
    ctx.fillText(metadata.authorUsername, 100, 40);

    // Draw username elements
    ctx.fillStyle = 'gray';
    ctx.font = '18px ' + globalFont;
    ctx.fillText(`@${metadata.authorNick}`, 100, 60);

    // Draw description (post text wrap handling)
    ctx.fillStyle = 'white';
    const descXPosition = !hasImgs && hasVids ? 80 : 30;
    ctx.textDrawingMode = "glyph";
    ctx.font = '24px "Noto Color Emoji"';
    drawDescription(ctx, hasImgs, hasVids, hasOnlyVideos, descLines, globalFont, descXPosition, defaultYPosition);

    // Draw date elements
    ctx.fillStyle = 'gray';
    ctx.font = '18px ' + globalFont;
    ctx.fillText(formatTwitterDate(metadata.date), 30, calculatedCanvasHeightFromDescLines - 20);

    // Draw the circle mask...
    ctx.save();
    const radius = 25;
    ctx.beginPath();
    ctx.arc(45, 45, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    // Draw pfp image centered in the circle
    ctx.drawImage(pfp, 20, 20, 50, radius * 2);
    ctx.restore();
};

module.exports = {
    getWrappedText,
    setFontBasedOnContent,
    drawDescription,
    drawTextWithSpacing,
    drawBasicElements,
};
