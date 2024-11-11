const {
    registerFont,
    createCanvas,
    loadImage,
} = require('canvas');
const { renderImageGallery } = require('./image_gallery_rendering.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');
const { getWrappedText, drawBasicElements, drawQtBasicElements } = require('../twitter-core/canvas_utils.js');
const { filterMediaUrls, removeTCOLink } = require('../twitter-core/utils.js');

const createTwitterCanvas = async (metadataJson, isImage) => {

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: removeTCOLink(metadataJson.text),
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
    };

    let qtMetadata = null;
    if(metadataJson.qtMetadata) {
        qtMetadata = {
            authorNick: metadataJson.qtMetadata.user_screen_name,
            authorUsername: metadataJson.qtMetadata.user_name,
            pfpUrl: metadataJson.qtMetadata.user_profile_image_url,
            date: metadataJson.qtMetadata.date,
            description: metadataJson.qtMetadata.text || '', // TODO: truncate
            mediaUrls: metadataJson.qtMetadata.mediaURLs,
            mediaExtended: metadataJson.qtMetadata.media_extended,
        };
    }

    console.log('>>>>> twitter_canvas > createTwitterCanvas >  > metadata: ', metadata);

    // Unnecessary if the font is loaded in the local OS
    // TODO: Investigate if `fonts/` is even necessary...
    registerFont('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', { family: 'Noto Color Emoji' });

    // Register Noto Sans CJK Regular and Bold
    registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc', { family: 'Noto Sans CJK' });

    const globalFont = '"Noto Color Emoji", "Noto Sans CJK"';

    const maxCanvasWidth = 600;
    let canvasHeight = 650;
    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    // Grants emoji color
    ctx.textDrawingMode = "glyph";

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

    const numOfImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    console.log('>>>>> twitter_canvas > createTwitterCanvas >  > numOfImgs', numOfImgs);
    const numOfVideos = filterMediaUrls(metadata, ['mp4']).length;
    console.log('>>>>> twitter_canvas > createTwitterCanvas >  > numOfVideos', numOfVideos);
    let mediaMaxHeight = getMaxHeight(numOfImgs);
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
        // console.log('>>>>> twitter_canvas > createTwitterCanvas > has images!');
        mediaObject = {
            height: metadata.mediaExtended[0].size.height,
            width: metadata.mediaExtended[0].size.width,
        };
        // Recusively scale down by half if larger than allowed
        // console.log('>>>>> twitter_canvas > createTwitterCanvas > hasImgs > mediaObject: ', mediaObject);
        mediaObject = scaleDownToFitAspectRatio(mediaObject, mediaMaxHeight, mediaMaxWidth);
        if(metadata.mediaExtended.length < 2 && mediaObject.width > mediaObject.height) {
            const newWidthRatio = mediaMaxWidth / mediaObject.width;
            // console.log('>>>>> twitter_canvas > createTwitterCanvas > newWidthRatio: ', newWidthRatio);
            const adjustedHeight = mediaObject.height * newWidthRatio;
            // console.log('>>>>> twitter_canvas > createTwitterCanvas > adjustedHeight: ', adjustedHeight);
            heightShim = adjustedHeight;    
        } else {
            // heightShim = mediaMaxHeight;
            console.log('>>>>> twitter_canvas > createTwitterCanvas > mediaObject.height: ', mediaObject.height);
            console.log('>>>>> twitter_canvas > createTwitterCanvas > mediaMaxHeight: ', mediaMaxHeight);
            heightShim = mediaObject.height < mediaMaxHeight ? mediaObject.height : mediaMaxHeight;
        }
    }

    let qtDescLines = [];

    const calcQtHeight = (qtMetadata) => {
        let minHeight = 180;
    
        // TODO: Calculate new descLines here
        qtDescLines = getWrappedText(ctx, qtMetadata.description, 320);
        console.log('>>>>> twitter_canvas > calcQtHeight > qtDescLines[1]: ', qtDescLines);
        // const descLinesFilteredEmptyLines = qtDescLines.filter(line => line !== '');
        // console.log('>>> descLinesFilteredEmptyLines: ', descLinesFilteredEmptyLines);
        // const descLinesLength = descLinesFilteredEmptyLines?.length;
        let qtDescLinesLength = qtDescLines?.length;
        console.log('>>>>> twitter_canvas > calcQtHeight > qtDescLinesLength[1]: ', qtDescLinesLength);
        let totalQtDescLinesHeight = qtDescLinesLength * 30 + 100; // 30 is the lineheight and 100 is bottompadding
        console.log('>>>>> twitter_canvas > calcQtHeight > totalQtDescLinesHeight[1]: ', totalQtDescLinesHeight);
        // if has media...
        if(qtMetadata.mediaUrls.length > 0) {
            console.log('>>>>> twitter_canvas > calcQtHeight > calcQtHeight has media!');
            qtDescLines = getWrappedText(ctx, qtMetadata.description, 120);
            qtDescLinesLength = qtDescLines?.length;
            totalQtDescLinesHeight = qtDescLinesLength * 30; // remove the bottom padding since we don't need it
            minHeight = 330;
        } else {
            console.log('>>>>> twitter_canvas > calcQtHeight > calcQtHeight has NO media...');
        }
        console.log('>>>>> twitter_canvas > calcQtHeight > qtDescLines[2]: ', qtDescLines);
        console.log('>>>>> twitter_canvas > calcQtHeight > qtDescLinesLength[2]: ', qtDescLinesLength);
       
        console.log('>>>>> twitter_canvas > calcQtHeight > minHeight: ', minHeight);
        const finalHeight = minHeight > totalQtDescLinesHeight ? minHeight : totalQtDescLinesHeight;
        console.log('>>>>> twitter_canvas > calcQtHeight > totalQtDescLinesHeight[2]: ', totalQtDescLinesHeight);
        return finalHeight;
    };

    // const calcQtHeight = (ctx, qtMetadata, maxCharLength) => {
    //     const qtDescLines = getWrappedText(ctx, qtMetadata.description, maxCharLength);
    
    //     // Dynamically calculate description height
    //     const descHeight = qtDescLines.length * 30; // Assuming line height of 30
    //     const minHeight = 180; // Minimum height for quote tweet box
    //     const padding = 60; // Additional padding for avatar, margins
    
    //     let totalHeight = descHeight + padding;
    
    //     // Account for media height
    //     if (qtMetadata.mediaUrls.length > 0) {
    //         totalHeight += 300; // Approximate media height
    //     }
    
    //     return Math.max(totalHeight, minHeight);
    // };
    
  
    // Pre-process description with text wrapping
    const maxCharLength = hasOnlyVideos ? 120 : 240; // Maximum width for text
    const descLines = getWrappedText(ctx, metadata.description, maxCharLength);
    let defaultYPosition = 110; // Starting Y position for description text

    // New height calcs
    const descLinesLength = descLines.length;
    console.log('>>>>> twitter_canvas > descLinesLength: ', descLinesLength);
    let calculatedCanvasHeightFromDescLines = hasVids && !hasImgs
        ? maxCanvasWidth // Has vids, make square
        : (descLinesLength * 30) + defaultYPosition + 40 + heightShim;
    console.log('>>>>> twitter_canvas > calculatedCanvasHeightFromDescLines[1]: ', calculatedCanvasHeightFromDescLines);
    if(!metadata.description) {
        calculatedCanvasHeightFromDescLines = calculatedCanvasHeightFromDescLines - 40;
    }
    console.log('>>>>> twitter_canvas > calculatedCanvasHeightFromDescLines[2]: ', calculatedCanvasHeightFromDescLines);

    let qtCalculatedCanvasHeightFromDescLines = 0;
    if(qtMetadata) {
        qtCalculatedCanvasHeightFromDescLines = calcQtHeight(qtMetadata) + 100; 
        // qtCalculatedCanvasHeightFromDescLines = calcQtHeight(ctx, qtMetadata, maxCharLength); 
    }
    console.log('>>>>> twitter_canvas > qtCalculatedCanvasHeightFromDescLines[1]: ', qtCalculatedCanvasHeightFromDescLines);
  
    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines + qtCalculatedCanvasHeightFromDescLines;
    console.log('>>>>> twitter_canvas > ctx.canvas.height: ',  ctx.canvas.height);
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines + qtCalculatedCanvasHeightFromDescLines);
    
    const favIconUrl = 'https://abs.twimg.com/favicons/twitter.3.ico';
    const favicon = await loadImage(favIconUrl);
    const pfpUrl = metadata.pfpUrl;
    const pfp = await loadImage(pfpUrl);

    // Standard Post
    drawBasicElements(ctx, globalFont, metadata, favicon, pfp, descLines, {
        hasImgs, hasVids,
        yOffset: defaultYPosition,
        canvasHeightOffset: calculatedCanvasHeightFromDescLines,
    });

    console.log('>>>>> twitter_canvas > qtMetadata: ', qtMetadata);
    // if has quote tweet reference
    if(qtMetadata) {
        console.log('>>>>> if(qtMetadata) > qtMetadata EXISTS!!!');
        // Pre-process media
        const numOfQtImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length;
        console.log('>>>>> if(qtMetadata) > numOfQtImgs', numOfQtImgs);
        const numOfQtVideos = filterMediaUrls(qtMetadata, ['mp4']).length;
        // console.log('>>>>> if(qtMetadata) > numOfQtVideos', numOfQtVideos);

        // load media
        const qtPfpUrl = qtMetadata.pfpUrl;
        const qtPfp = await loadImage(qtPfpUrl);

        console.log('>>>> twitter_canvas > calculatedCanvasHeightFromDescLines[3]: ', calculatedCanvasHeightFromDescLines);
        console.log('>>>> twitter_canvas > qtCalculatedCanvasHeightFromDescLines[2]: ', qtCalculatedCanvasHeightFromDescLines);

        // Quote-Tweet Post has images, but no videos
        if(numOfQtImgs > 0 && numOfQtVideos === 0) {
            const qtMainMedia1Url = qtMetadata.mediaUrls[0];
            const qtMainMedia1 = await loadImage(qtMainMedia1Url);
            drawQtBasicElements(ctx, globalFont, qtMetadata, qtPfp, qtMainMedia1, undefined, {
                canvasHeightOffset: calculatedCanvasHeightFromDescLines,
                qtCanvasHeightOffset: qtCalculatedCanvasHeightFromDescLines,
                hasImgs,
                hasVids,
                hasOnlyVideos,
                qtDescLines
            });
        }
        // Quote-Tweet Post has videos, but no images
        if (numOfQtVideos > 0 && numOfQtImgs === 0) {
            const qtVidThumbnailUrl = qtMetadata.mediaExtended[0].thumbnail_url;
            const qtVidThumbnail = await loadImage(qtVidThumbnailUrl);
            drawQtBasicElements(ctx, globalFont, qtMetadata, qtPfp, undefined, qtVidThumbnail, {
                canvasHeightOffset: calculatedCanvasHeightFromDescLines,
                qtCanvasHeightOffset: qtCalculatedCanvasHeightFromDescLines,
                hasImgs,
                hasVids,
                hasOnlyVideos,
                qtDescLines
            });
        }
        // Quote-Tweet Post is text only
        if (numOfQtVideos === 0 && numOfQtImgs === 0) {
            drawQtBasicElements(ctx, globalFont, qtMetadata, qtPfp, undefined, undefined, {
                canvasHeightOffset: calculatedCanvasHeightFromDescLines,
                qtCanvasHeightOffset: qtCalculatedCanvasHeightFromDescLines,
                hasImgs,
                hasVids,
                hasOnlyVideos,
                qtDescLines
            });
        }
    }

    // Draw the image, if one exists...
    if (hasImgs && !hasVids) {
        await renderImageGallery(
            ctx,
            metadata,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth,
            defaultYPosition,
        );
    }

    // Convert the canvas to a Buffer and return it
    return isImage ? canvas.toBuffer('image/png') : canvas.toBuffer();
};

module.exports = { createTwitterCanvas };
