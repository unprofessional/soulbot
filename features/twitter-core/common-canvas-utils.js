const { createCanvas, loadImage } = require('canvas');

const TimeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
const { cropSingleImage } = require('../twitter-post/crop_single_image');
TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

const initializeCanvas = (maxCanvasWidth = 600, canvasHeight = 650) => {

    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    return { canvas, ctx };
};

// Height adjustment for images
const getMaxHeight = (numImgs) => {
    switch(numImgs) {
    case 1: return 800;
    case 2: return 600;
    case 3: return 530;
    case 4: return 530;
    default: return 600;
    }
};

/**
 * The goal of this it to pull "common" canvas context drawings defined here.
 * 
 * Eventually, I'll want to refactor this even further and have a single jump off
 * point that any other canvas can "extend" including drawing all of the basic elements
 * i.e. image and video canvases should share the same common canvas with basic elements
 * 
 * 1. pass in the ctx
 * 2. perform drawing ops
 * 3. return the ctx
 */

const filterMediaUrls = (metadata, extensions) => {
    return metadata.mediaUrls.filter((mediaUrl) => {
        const mediaUrlParts = mediaUrl.split('.');
        const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        const fileExtension = fileExtensionWithQueryParams.split('?')[0];
        return extensions.includes(fileExtension);
    });
};

const getWrappedText = (ctx, text, maxWidth, hasVids) => {
    const lines = [];
    const paragraphs = hasVids
        ? [text.replace(/\n/g, ' ')]
        : text.split('\n'); // Conditionally handle newlines

    paragraphs.forEach(paragraph => {
        const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/;
        const containsUrl = shortTwitterUrlPattern.test(paragraph);
        const matches = paragraph.split(shortTwitterUrlPattern);

        if(containsUrl && matches[0]) {
            paragraph = matches[0];
        }

        if (paragraph === '') {
            lines.push(''); // Handle blank lines (paragraph breaks)
        } else {
            const words = paragraph.split(' ');
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + ' ' + word).width;
                // console.log('!!!!! getWrappedText > width: ', width);
                // console.log('!!!!! getWrappedText > maxWidth: ', maxWidth);
            
                if (width < maxWidth) {
                    currentLine += ' ' + word;
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

const formatTwitterDate = (twitterDate) => {
    // Parse the date string and create a Date object
    const date = new Date(twitterDate);
    return timeAgo.format(date); 
};

const getMediaMetadata = (metadata) => {
    const numOfImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    console.log('>>>>> getMediaMetadata > numOfImgs', numOfImgs);
    const numOfVideos = filterMediaUrls(metadata, ['mp4']).length;
    console.log('>>>>> getMediaMetadata > numOfVideos', numOfVideos);
    let mediaMaxHeight = getMaxHeight(numOfImgs);
    let mediaMaxWidth = 560;
    const hasImgs = numOfImgs > 0;
    const hasVids = numOfVideos > 0;
    const hasOnlyVideos = numOfVideos > 0 && !hasImgs;
    const hasMedia = numOfImgs > 0 || numOfVideos > 0;
    return {
        numOfImgs, numOfVideos,
        mediaMaxHeight, mediaMaxWidth,
        hasImgs, hasVids, hasOnlyVideos, hasMedia
    };
};

const calcQtHeight = (qtMetadata, ctx, hasOnlyVideos) => {
    let minHeight = 180;
    
    // TODO: Calculate new descLines here
    const qtDescLines = getWrappedText(ctx, qtMetadata.description, 120, hasOnlyVideos);
    console.log('>>> qtDescLines: ', qtDescLines);
    const descLinesFilteredEmptyLines = qtDescLines.filter(line => line !== '');
    console.log('>>> descLinesFilteredEmptyLines: ', descLinesFilteredEmptyLines);
    const descLinesLength = descLinesFilteredEmptyLines?.length;
    console.log('>>> descLinesLength: ', descLinesLength);
    
    // If Media exists
    if(qtMetadata.mediaUrls.length > 0) {
        console.log('>>>>> calcQtHeight has media!');
        minHeight = 330;
    }
    const totalDescLinesHeight = descLinesLength * 40;
    return minHeight > totalDescLinesHeight ? minHeight : totalDescLinesHeight;
};

const drawBasicElements = async (ctx, metadata, favicon, pfp, globalFont, isQuoteTweet = false) => {

    const maxCanvasWidth = 600;

    let heightShim = 0;

    const { numOfImgs, numOfVideos, hasImgs, hasVids, hasOnlyVideos, hasMedia } = getMediaMetadata(metadata);

    // FIXME: Quote-Tweet only...
    let mediaQtMaxHeight = hasMedia ? 300 : 100;
    let mediaQtMaxWidth = 560;

    let maxCharLength = hasOnlyVideos ? 120 : 220; // Maximum width for text
    let descLines = getWrappedText(ctx, metadata.description, maxCharLength, hasOnlyVideos);
    if(isQuoteTweet) {
        maxCharLength = hasMedia ? 250 : 320; // Maximum width for text
        descLines = getWrappedText(ctx, metadata.description, maxCharLength, true);
    }

    let defaultYPosition = 110;

    const descLinesLength = descLines.length;
    let calculatedCanvasHeightFromDescLines = hasVids && !hasImgs
        ? maxCanvasWidth // Has vids, make square
        : (descLinesLength * 30) + defaultYPosition + 40 + heightShim;
    if(!metadata.description) {
        calculatedCanvasHeightFromDescLines = calculatedCanvasHeightFromDescLines - 40;
    }

    let yPosition = 0;

    if (isQuoteTweet) {

        const qtCalculatedCanvasHeightFromDescLines = calcQtHeight(metadata, ctx, hasOnlyVideos); 

        const qtXPosition = 20;
        yPosition = calculatedCanvasHeightFromDescLines;
        // QT Canvas Stroke
        ctx.strokeStyle = 'gray';
        console.log('>>> mediaQtMaxHeight: ', mediaQtMaxHeight);
        const minMediaHeight = 300;
        const determinedHeight = minMediaHeight > qtCalculatedCanvasHeightFromDescLines ? minMediaHeight : qtCalculatedCanvasHeightFromDescLines;
        ctx.strokeRect(qtXPosition, yPosition, mediaQtMaxWidth, determinedHeight - 20); // 20 offset to match the left and right margins
    } else { // is primary tweet metadata (not quote-tweet)
        // Load and draw favicon
        ctx.drawImage(favicon, 550, 20, 32, 32);
    }

    // Draw nickname elements
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px ' + globalFont;
    ctx.fillText(metadata.authorUsername, 100, yPosition + 40);

    // Draw username elements
    ctx.fillStyle = 'gray';
    ctx.font = '18px ' + globalFont;
    ctx.fillText(`@${metadata.authorNick}`, 100, yPosition + 60);

    if(isQuoteTweet) {
        // Draw description (post text wrap handling)
        ctx.fillStyle = 'white'; // Text color for description
        ctx.font = '24px ' + globalFont;
        const lineHeight = 30;
        const qtTextXAxisStart = hasMedia ? 230 : 100;
        descLines.forEach(line => {
            ctx.fillText(line, qtTextXAxisStart, yPosition + 100);
            yPosition += lineHeight;
        });
    } else {
        // Draw description (post text wrap handling)
        ctx.fillStyle = 'white';
        ctx.font = !hasImgs && hasVids ? '36px ' + globalFont : '24px ' + globalFont;
        const lineHeight = hasOnlyVideos ? 50 : 30;
        const descXPosition = !hasImgs && hasVids ? 80 : 30;
        descLines.forEach(line => {
            ctx.fillText(line, descXPosition, defaultYPosition);
            defaultYPosition += lineHeight;
        });

        // Draw date elements
        ctx.fillStyle = 'gray';
        ctx.font = '18px ' + globalFont;
        ctx.fillText(`${formatTwitterDate(metadata.date)} from this posting`, 30, calculatedCanvasHeightFromDescLines - 20);
    }

    if (isQuoteTweet) {

        ctx.drawImage(pfp, 40, calculatedCanvasHeightFromDescLines + 20, 50, 50);

        const qtMediaYPos = calculatedCanvasHeightFromDescLines + 80;
        console.log('>>>>> qtMediaYPos: ', qtMediaYPos);

        const qtXPosition = 20;

        const mainMedia1 = metadata.mediaUrls[0];

        // or if (mainMedia1 !== undefined)
        if(numOfImgs > 0 && numOfVideos === 0) {
            cropSingleImage(ctx, mainMedia1, 175, 175, qtXPosition + 20, qtMediaYPos);
        }

        // or if (qtVidThumbnail)
        if(numOfVideos > 0) {
            const qtVidThumbnailUrl = metadata.mediaExtended[0].thumbnail_url;
            const qtVidThumbnail = await loadImage(qtVidThumbnailUrl);
            cropSingleImage(ctx, qtVidThumbnail, 175, 175, qtXPosition + 20, qtMediaYPos);
        }
    } else {
        // Draw the primary tweet pfp circle mask...
        ctx.save();
        const radius = 25;
        ctx.beginPath();
        ctx.arc(45, 45, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        // Draw the image centered in the circle
        ctx.drawImage(pfp, 20, 20, 50, radius * 2);
        ctx.restore();
    }
};

module.exports = {
    getMaxHeight,
    initializeCanvas,
    getWrappedText,
    filterMediaUrls,
    getMediaMetadata,
    drawBasicElements,
};
