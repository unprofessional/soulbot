const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const {
    registerFont,
    createCanvas,
    loadImage,
} = require('canvas');
const { buildPathsAndStuff } = require('../twitter-core/path_builder.js');
const { getWrappedText, drawBasicElements, getAdjustedAspectRatios } = require('../twitter-core/canvas_utils.js');

const createTwitterVideoCanvas = async (metadataJson) => {

    console.log('>>>>> createTwitterVideoCanvas reached!');

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: metadataJson.text || "",
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
    };
    // console.log('>>>>> createTwitterVideoCanvas > metadata: ', metadata);

    // const baseFontUrl = '/Users/power/dev/devcru/soulbot/fonts';
    const baseFontUrl = '/usr/share/fonts';

    // Unnecessary if the font is loaded in the local OS
    // TODO: Investigate if `fonts/` is even necessary...
    registerFont(`${baseFontUrl}/truetype/noto/NotoColorEmoji.ttf`, { family: 'Noto Color Emoji' });

    // // For Gothic etc
    registerFont(`${baseFontUrl}/truetype/noto/NotoSansMath-Regular.ttf`, { family: 'Noto Sans Math' });

    // // Register Noto Sans CJK Regular and Bold
    registerFont(`${baseFontUrl}/opentype/noto/NotoSansCJK-VF.ttf.ttc`, { family: 'Noto Sans CJK' });

    const globalFont = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

    const maxCanvasWidth = 600;
    let canvasHeight = 650;
    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    // Grants emoji color
    ctx.textDrawingMode = "glyph";

    let mediaMaxHeight = 600; // getMaxHeight(numOfImgs);
    let mediaMaxWidth = 560;

    // Default media embed dimensions
    let mediaObject = {
        height: 0,
        width: 0,
    };

    let heightShim = mediaMaxHeight;

    // console.log('>>>>> has images!');
    mediaObject = {
        height: metadata.mediaExtended[0].size.height,
        width: metadata.mediaExtended[0].size.width,
    };

    // if more wide than tall, heightShim should be scaled down with width ratio
    if(mediaObject.width > mediaObject.height) {
        const newWidthRatio = mediaMaxWidth / mediaObject.width;
        const adjustedHeight = mediaObject.height * newWidthRatio;
        heightShim = adjustedHeight;    
    }

    // Pre-process description with text wrapping
    ctx.font = '18px "Noto Color Emoji"'; // we need to set the intended font here first before calcing it
    const descLines = getWrappedText(ctx, metadata.description, 420);
    let defaultYPosition = 110; // Starting Y position for description text

    // New height calcs
    const descLinesLength = descLines.length;
    const calculatedCanvasHeightFromDescLines = (descLinesLength * 30) + defaultYPosition + 40 + heightShim;

    // console.log('>>>>> calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);

    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines;
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines);
  
    const favIconUrl = 'https://abs.twimg.com/favicons/twitter.3.ico';
    const favicon = await loadImage(favIconUrl);
    const pfpUrl = metadata.pfpUrl;
    const pfp = await loadImage(pfpUrl);

    // Standard Post
    drawBasicElements(ctx, globalFont, metadata, favicon, pfp, descLines, {
        hasImgs: true, hasVids: true,
        yOffset: defaultYPosition,
        canvasHeightOffset: calculatedCanvasHeightFromDescLines,
    });

    // Alpha layer mask attempt... uncomment when implementing!
    // const {
    //     adjustedCanvasWidth, adjustedCanvasHeight,
    //     scaledDownObjectWidth, scaledDownObjectHeight,
    //     overlayX, overlayY
    // } = getAdjustedAspectRatios(
    //     maxCanvasWidth, canvasHeight,
    //     mediaObject.width, mediaObject.height,
    //     heightShim
    // );

    // TODO: Utility function
    const videoUrl = metadata.mediaUrls[0];
    // console.log('>>>>> twitter_video_canvas > videoUrl: ', videoUrl);

    // Convert the canvas to a buffer
    const buffer = canvas.toBuffer('image/png');

    // Write the buffer to a file
    /**
     * TODO TODO TODO — use temp filename first... UUID? then track state
     */
    const processingDir = '/tempdata';
    const pathObj = buildPathsAndStuff(processingDir, videoUrl);
    const filename = pathObj.filename;
    const localWorkingPath = pathObj.localWorkingPath;
    const localFilename = `${filename}.png`;

    // console.log('>>>>> twitter_video_canvas > localWorkingPath: ', localWorkingPath);

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
