const { cropSingleImage } = require("../twitter-post/crop_single_image");
const { formatTwitterDate, filterMediaUrls } = require("./utils");

function getWrappedText(ctx, text, maxWidth) {

    console.log('>>>>> canvas_utils > drawDescription > text: ', text);
    console.log('>>>>> canvas_utils > drawDescription > maxWidth: ', maxWidth);

    // Enforce this on every call....
    // ctx.font = '24px "Noto Color Emoji"'; // we need to set the intended font here first before calcing it

    const lines = [];
    // const paragraphs = hasVids
    //     ? [text.replace(/\n/g, ' ')]
    //     : text.split('\n'); // Conditionally handle newlines
    const paragraphs = text.split('\n');

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

            console.log('@@@ Current Font Before Wrapping:', ctx.font);
            console.log('@@@ maxWidth:', maxWidth);

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                console.log('@@@ currentLine:', currentLine);
                console.log('@@@ width:', width);

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

// ....hasOnlyVideos might be the wrong descriptor... could be QTVideo?????
const drawDescription = (ctx, hasImgs, hasVids, descLines, font, x, y, isQt) => {
    console.log('>>>>> canvas_utils > drawDescription > descLines: ', descLines);
    console.log('>>>>> canvas_utils > drawDescription > descLines.length: ', descLines.length);
    // const isQtWithMedia = isQt && (hasImgs || hasVids);
    // const lineHeight = isQtWithMedia ? 24 : 30;
    const lineHeight = 30;
    console.log('>>>>> canvas_utils > drawDescription > hasImgs || hasVids: ', hasImgs || hasVids);
    descLines.forEach(line => {
        ctx.textDrawingMode = "glyph";
        // ctx.font = isQt ? '18px "Noto Color Emoji"' : '24px "Noto Color Emoji"';
        // ctx.font = isQtWithMedia ? '18px "Noto Color Emoji"' : '24px "Noto Color Emoji"';
        ctx.font = '24px "Noto Color Emoji"';
        // if(!hasImgs && hasVids) {
        //     console.log('>>>>> canvas_utils > drawDescription > !hasImgs and hasVids!');
        //     ctx.font = '36px ' + font;
        // }
        console.log('!!! canvas_utils > drawDescription > line: ', line);
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
    ctx, globalFont, metadata, favicon, pfp, descLines, options
) => {

    const {
        yOffset = 0,
        canvasHeightOffset = 0,
        hasImgs = false,
        hasVids = false,
    } = options;

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
    drawDescription(ctx, hasImgs, hasVids, descLines, globalFont, descXPosition, yOffset);

    // Draw date elements
    ctx.fillStyle = 'gray';
    ctx.font = '18px ' + globalFont;
    ctx.fillText(formatTwitterDate(metadata.date), 30, canvasHeightOffset - 20);

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

const drawQtBasicElements = (
    ctx, globalFont, metadata, pfp, mainMedia1, qtVidThumbnail, options
) => {

    const {
        // isQuoteTweet = false,
        // mediaElements = {},
        // yOffset = 0,
        canvasHeightOffset = 0,
        qtCanvasHeightOffset = 0,
        hasImgs = false,
        hasVids = false,
        // qtDescLines = [],
    } = options;

    console.log('>>>>> canvas_utils > drawQtBasicElements > qtMeta: ', metadata);
    
    // Pre-process media
    const numOfQtImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    console.log('>>>>> canvas_utils > drawQtBasicElements > qtMeta > numOfQtImgs', numOfQtImgs);
    const numOfQtVideos = filterMediaUrls(metadata, ['mp4']).length;
    console.log('>>>>> canvas_utils > drawQtBasicElements > numOfQtVideos', numOfQtVideos);
    const hasMedia = numOfQtImgs > 0 || numOfQtVideos > 0;
    
    const minHeight = 100;
    let mediaQtMaxHeight = hasMedia ? 300 : minHeight;
    let mediaQtMaxWidth = 560;
    
    // Pre-process description with text wrapping
    const qtMaxCharLength = hasMedia ? 320 : 420; // Maximum width for text
    ctx.font = '24px ' + globalFont; // gotta set this here before getWrappedText for size calcs
    const qtDescLines = getWrappedText(ctx, metadata.description, qtMaxCharLength, true);
    
    const qtXPosition = 20;
    let qtYPosition = canvasHeightOffset;
    
    // QT Canvas Stroke
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 1;  // Set the stroke width (optional)
    const cornerRadius = 15; // Adjust corner radius as needed
    console.log('>>>>> canvas_utils > drawQtBasicElements > mediaQtMaxHeight: ', mediaQtMaxHeight);
    console.log('>>>>> canvas_utils > drawQtBasicElements > qtCanvasHeightOffset: ', qtCanvasHeightOffset);
    if (hasMedia) {
        const minMediaHeight = 80 + 175 + 30; // qtMediaOffset + qtMediaStaticHeight + qtBottomPadding
        console.log('>>>>> canvas_utils > drawQtBasicElements > minMediaHeight: ', minMediaHeight);
        const determinedHeight = minMediaHeight > qtCanvasHeightOffset ? minMediaHeight : qtCanvasHeightOffset;
        console.log('>>>>> canvas_utils > drawQtBasicElements > determinedHeight: ', determinedHeight);
        // ctx.strokeRect(qtXPosition, qtYPosition, mediaQtMaxWidth, determinedHeight - 20); // 20 offset to match the left and right margins
        ctx.beginPath();
        ctx.roundRect(qtXPosition, qtYPosition, mediaQtMaxWidth, determinedHeight - 20, cornerRadius);
        ctx.stroke();
    } else {
        // ctx.strokeRect(qtXPosition, qtYPosition, mediaQtMaxWidth, qtCanvasHeightOffset - 20); // 20 offset to match the left and right margins
        ctx.beginPath();
        ctx.roundRect(qtXPosition, qtYPosition, mediaQtMaxWidth, qtCanvasHeightOffset - 20, cornerRadius);
        ctx.stroke();
    }
    
    // Draw nickname elements
    ctx.fillStyle = 'white'; // Text color
    ctx.font = 'bold 18px ' + globalFont;
    ctx.fillText(metadata.authorUsername, 100, qtYPosition + 40);
  
    // Draw nickname elements
    ctx.fillStyle = 'gray'; // Text color
    ctx.font = '18px ' + globalFont;
    ctx.fillText(`@${metadata.authorNick}`, 100, qtYPosition + 60);
  
    // Draw description (post text wrap handling)
    ctx.fillStyle = 'white'; // Text color for description
    ctx.font = '24px ' + globalFont;
    const qtTextXAxisStart = hasMedia ? 230 : 100;
    drawDescription(ctx, hasImgs, hasVids, qtDescLines, globalFont, qtTextXAxisStart, qtYPosition, true);

    // Draw pfp image
    ctx.drawImage(pfp, 40, canvasHeightOffset + 20, 50, 50);
    
    const qtMediaYPos = canvasHeightOffset + 80;
    console.log('>>>>> canvas_utils > drawQtBasicElements > qtMediaYPos: ', qtMediaYPos);

    // or if (mainMedia1 !== undefined)
    if(numOfQtImgs > 0 && numOfQtVideos === 0) {
        cropSingleImage(ctx, mainMedia1, 175, 175, qtXPosition + 20, qtMediaYPos);
    }

    // or if (qtVidThumbnail)
    if(numOfQtVideos > 0) {
        cropSingleImage(ctx, qtVidThumbnail, 175, 175, qtXPosition + 20, qtMediaYPos);
    }
    
};

module.exports = {
    getWrappedText,
    drawDescription,
    drawTextWithSpacing,
    drawBasicElements,
    drawQtBasicElements,
};
