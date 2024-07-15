const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { 
    mkdir,
    // readFile,
    readdir,
    stat,
    writeFile,
} = require('node:fs').promises
const {
    // registerFont,
    createCanvas,
    loadImage,
} = require('canvas');
// const { cropSingleImage } = require('./crop_single_image.js');
const { singleVideoFrame } = require('../twitter-post/image_gallery_rendering.js');
const { 
    downloadVideo,
    extractAudioFromVideo,
    extractFrames,
    recombineFramesToVideo,
    combineAudioWithVideo,
} = require('./index.js');
const { buildPathsAndStuff } = require('../twitter-core/path_builder.js');
const TimeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

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

const formatTwitterDate = (twitterDate) => {
    // Parse the date string and create a Date object
    const date = new Date(twitterDate);
    return timeAgo.format(date); 
};

const createTwitterVideoCanvas = async (metadataJson) => {
    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: metadataJson.text || "",
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
    };
    console.log('>>>>> createTwitterVideoCanvas > metadata: ', metadata);

    const globalFont = 'Arial';
    const maxCanvasWidth = 600;
    let canvasHeight = 650;
    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    const numOfImgs = 1;//filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    console.log('>>>>> createTwitterCanvas > numOfImgs', numOfImgs);
    const numOfVideos = 1;//filterMediaUrls(metadata, ['mp4']).length;
    console.log('>>>>> createTwitterCanvas > numOfVideos', numOfVideos);
    let mediaMaxHeight = 600;//getMaxHeight(numOfImgs);
    let mediaMaxWidth = 560;
    const hasImgs = numOfImgs > 0;
    const hasVids = numOfVideos > 0;
    const hasOnlyVideos = numOfVideos > 0 && !hasImgs;

    // Default media embed dimensions
    let mediaObject = {
        height: 0,
        width: 0,
    };

    let heightShim = 0;

    if(hasImgs) {
        // console.log('>>>>> has images!');
        mediaObject = {
            height: metadata.mediaExtended[0].size.height,
            width: metadata.mediaExtended[0].size.width,
        };
        // console.log('>>>>> hasImgs > mediaObject: ', mediaObject);
        if(metadata.mediaExtended.length < 2 && mediaObject.width > mediaObject.height) {
            const newWidthRatio = mediaMaxWidth / mediaObject.width;
            // console.log('>>>>> newWidthRatio: ', newWidthRatio);
            const adjustedHeight = mediaObject.height * newWidthRatio;
            // console.log('>>>>> adjustedHeight: ', adjustedHeight);
            heightShim = adjustedHeight;    
        } else {
            heightShim = mediaMaxHeight;
        }
    }

    // Pre-process description with text wrapping
    const maxCharLength = hasOnlyVideos ? 120 : 220; // Maximum width for text
    const descLines = getWrappedText(ctx, metadata.description, maxCharLength, hasOnlyVideos);
    let defaultYPosition = 110; // Starting Y position for description text

    // New height calcs
    const descLinesLength = descLines.length;
    const calculatedCanvasHeightFromDescLines = hasVids && !hasImgs
        ? maxCanvasWidth // Has vids, make square
        : (descLinesLength * 30) + defaultYPosition + 40 + heightShim;

    console.log('>>>>> calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);

    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines;
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines);

    const drawBasicElements = (metadata, favicon, pfp) => {
        // Load and draw favicon
        ctx.drawImage(favicon, 550, 20, 32, 32);

        // Draw nickname elements
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px ' + globalFont;
        ctx.fillText(metadata.authorUsername, 100, 40);

        // Draw username elements
        ctx.fillStyle = 'gray';
        ctx.font = '18px ' + globalFont;
        ctx.fillText(`@${metadata.authorNick}`, 100, 60);
  
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
  
        // Draw pfp image
        ctx.drawImage(pfp, 20, 20, 50, 50);
    };
  
    const favIconUrl = 'https://abs.twimg.com/favicons/twitter.3.ico';
    const favicon = await loadImage(favIconUrl);
    const pfpUrl = metadata.pfpUrl;
    const pfp = await loadImage(pfpUrl);
    drawBasicElements(metadata, favicon, pfp);

    // TODO: Utility function
    const videoUrl = metadata.mediaUrls[0];
    console.log('>>>>> twitter_video_canvas > videoUrl: ', videoUrl);

    // Convert the canvas to a buffer
    const buffer = canvas.toBuffer('image/png');

    // Write the buffer to a file
    /**
     * TODO TODO TODO — use temp filename first
     */
    const processingDir = '/tempdata';
    const pathObj = buildPathsAndStuff(processingDir, videoUrl);
    const filename = pathObj.filename;
    const localWorkingPath = pathObj.localWorkingPath;
    const localFilename = `${filename}.png`;

    console.log('>>>>> twitter_video_canvas > localWorkingPath: ', localWorkingPath);

    /**
     * Rewrite with proper async handling for failure-cases...
     */
    if (!existsSync(localWorkingPath)) {
        mkdirSync(localWorkingPath, { recursive: true });
    }
    writeFileSync(`${localWorkingPath}/${localFilename}`, buffer, (err) => {
        if (err) throw err;
        console.log('The file was saved!');
    });
    return {
        localFilename,
        canvasHeight: calculatedCanvasHeightFromDescLines,
        canvasWidth: mediaMaxWidth,
        heightShim,
    };
    
};

module.exports = { createTwitterVideoCanvas };
