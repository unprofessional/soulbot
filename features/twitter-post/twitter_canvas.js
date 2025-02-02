const {
    registerFont,
    createCanvas,
    loadImage,
} = require('canvas');
const { renderImageGallery } = require('./image_gallery_rendering.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');
const { getWrappedText, drawBasicElements, drawQtBasicElements, getYPosFromLineHeight, drawCommunityNote, drawQtMissingStatus } = require('../twitter-core/canvas_utils.js');
const { filterMediaUrls, removeTCOLink, getExtensionFromMediaUrl } = require('../twitter-core/utils.js');

const createTwitterCanvas = async (metadataJson, isImage) => {

    console.log('>>>>> createTwitterCanvas reached!');

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: removeTCOLink(metadataJson.text),
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
        communityNote: removeTCOLink(metadataJson.communityNote),
    };

    let qtMetadata = null;
    console.log('>>>>> createTwitterCanvas > metadataJson.qtMetadata[1]: ', metadataJson.qtMetadata);
    if(metadataJson.qtMetadata) {
        qtMetadata = {
            authorNick: metadataJson?.qtMetadata.user_screen_name,
            authorUsername: metadataJson.qtMetadata.user_name,
            pfpUrl: metadataJson.qtMetadata.user_profile_image_url,
            date: metadataJson.qtMetadata.date,
            description: metadataJson.qtMetadata.text || '', // TODO: truncate
            mediaUrls: metadataJson.qtMetadata.mediaURLs,
            mediaExtended: metadataJson.qtMetadata.media_extended,
        };
    }
    if(metadataJson?.qtMetadata?.error === 'No status found with that ID.') {
        qtMetadata = metadataJson;
    }
    console.log('>>>>> createTwitterCanvas > metadataJson.qtMetadata[2]: ', metadataJson.qtMetadata);

    // console.log('>>>>> twitter_canvas > createTwitterCanvas >  > metadata: ', metadata);

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
    // console.log('>>>>> twitter_canvas > createTwitterCanvas >  > numOfImgs', numOfImgs);
    const numOfVideos = filterMediaUrls(metadata, ['mp4']).length;
    // console.log('>>>>> twitter_canvas > createTwitterCanvas >  > numOfVideos', numOfVideos);
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
            // console.log('>>>>> twitter_canvas > createTwitterCanvas > mediaObject.height: ', mediaObject.height);
            // console.log('>>>>> twitter_canvas > createTwitterCanvas > mediaMaxHeight: ', mediaMaxHeight);
            heightShim = mediaObject.height < mediaMaxHeight ? mediaObject.height : mediaMaxHeight;
        }
    }

    let qtDescLines = [];

    const calcQtHeight = (qtMetadata) => {
        const bottomPadding = 30;
        const lineheight = 30;
        ctx.font = '24px "Noto Color Emoji"'; // we need to set the intended font here first before calcing it
        qtDescLines = getWrappedText(ctx, qtMetadata.description, 420);
        // console.log('>>>>> twitter_canvas > calcQtHeight > qtDescLines[1]: ', qtDescLines);
        let qtDescLinesLength = qtDescLines?.length;
        // console.log('>>>>> twitter_canvas > calcQtHeight > qtDescLinesLength[1]: ', qtDescLinesLength);
        let totalQtDescLinesHeight = (qtDescLinesLength * lineheight) + bottomPadding;
        // console.log('>>>>> twitter_canvas > calcQtHeight > totalQtDescLinesHeight[1]: ', totalQtDescLinesHeight);
        const hasMedia = qtMetadata.mediaUrls.length > 0;
        if(hasMedia) {
            // console.log('>>>>> twitter_canvas > calcQtHeight > calcQtHeight has media!');
            ctx.font = '24px "Noto Color Emoji"'; // we need to set the intended font here first before calcing it
            qtDescLines = getWrappedText(ctx, qtMetadata.description, 320);
            qtDescLinesLength = qtDescLines?.length;
            totalQtDescLinesHeight = qtDescLinesLength * lineheight; // remove the bottom padding since we don't need it
            const minMediaHeight = 175 + bottomPadding; // qtMediaOffset + qtMediaStaticHeight + bottomPadding
            const determinedHeight = minMediaHeight > totalQtDescLinesHeight ? minMediaHeight : totalQtDescLinesHeight;
            // console.log('>>>>> twitter_canvas > calcQtHeight > minMediaHeight: ', minMediaHeight);
            // console.log('>>>>> twitter_canvas > calcQtHeight > determinedHeight: ', determinedHeight);
            return determinedHeight;
        } else {
            // console.log('>>>>> twitter_canvas > calcQtHeight > calcQtHeight has NO media...');
            return totalQtDescLinesHeight;
        }
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
    const defaultYPosition = 110; // Starting Y position for description text
    const calculatedYPos = getYPosFromLineHeight(descLines, defaultYPosition);
    console.log('>>>>> twitter_canvas > defaultYPosition: ', defaultYPosition);

    // New height calcs
    const descLinesLength = descLines.length;
    // console.log('>>>>> twitter_canvas > descLinesLength: ', descLinesLength);
    let calculatedCanvasHeightFromDescLines = hasVids && !hasImgs
        ? maxCanvasWidth // Has vids, make square
        : (descLinesLength * 30) + defaultYPosition + 40 + heightShim;
    console.log('>>>>> twitter_canvas > calculatedCanvasHeightFromDescLines[1]: ', calculatedCanvasHeightFromDescLines);
    if(!metadata.description) {
        calculatedCanvasHeightFromDescLines = calculatedCanvasHeightFromDescLines - 40;
    }
    console.log('>>>>> twitter_canvas > calculatedCanvasHeightFromDescLines[2]: ', calculatedCanvasHeightFromDescLines);

    /////////////////////////////
    // REFACTOR REFACTOR REFACTOR
    /////////////////////////////
    // const communityNote = metadata.communityNote;
    // let communityNoteLines = [];
    // let communityNoteHeight = 0;
    // console.log('>>> communityNote: ', communityNote);
    // if(communityNote) {
    //     ctx.fillStyle = 'white'; // Text color for description
    //     ctx.font = '24px Arial';
    //     communityNoteLines = getWrappedText(ctx, communityNote, 530, false);
    //     console.log('>>> communityNoteLines.length: ', communityNoteLines.length);
    //     communityNoteHeight = (communityNoteLines.length * 30) + 60;
    // }
    /////////////////////////////
    // REFACTOR REFACTOR REFACTOR
    /////////////////////////////

    let qtCalculatedCanvasHeightFromDescLines = 0;
    if(qtMetadata) {
        qtCalculatedCanvasHeightFromDescLines = calcQtHeight(qtMetadata) + 100; 
        // qtCalculatedCanvasHeightFromDescLines = calcQtHeight(ctx, qtMetadata, maxCharLength); 
    }
    // console.log('>>>>> twitter_canvas > qtCalculatedCanvasHeightFromDescLines[1]: ', qtCalculatedCanvasHeightFromDescLines);
  
    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines
        // + communityNoteHeight
        + qtCalculatedCanvasHeightFromDescLines;
    // console.log('>>>>> twitter_canvas > ctx.canvas.height: ',  ctx.canvas.height);
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines
        // + communityNoteHeight
        + qtCalculatedCanvasHeightFromDescLines);
    
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

    // console.log('>>>>> twitter_canvas > qtMetadata: ', qtMetadata);
    // if has quote tweet reference
    if(qtMetadata && !qtMetadata.error) {
        console.log('>>>>> if(qtMetadata) > qtMetadata EXISTS!!!');
        const qtMedia1 = qtMetadata?.mediaUrls[0];
        console.log('>>>>> twitter_canvas > qtMedia1[1]: ', qtMedia1);
        // Pre-process media
        const numOfQtImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length;
        console.log('>>>>> if(qtMetadata) > numOfQtImgs: ', numOfQtImgs);
        const numOfQtVideos = filterMediaUrls(qtMetadata, ['mp4']).length;
        console.log('>>>>> if(qtMetadata) > numOfQtVideos: ', numOfQtVideos);

        // load media
        const qtPfpUrl = qtMetadata.pfpUrl;
        const qtPfp = await loadImage(qtPfpUrl);

        // console.log('>>>> twitter_canvas > calculatedCanvasHeightFromDescLines[3]: ', calculatedCanvasHeightFromDescLines);
        // console.log('>>>> twitter_canvas > qtCalculatedCanvasHeightFromDescLines[2]: ', qtCalculatedCanvasHeightFromDescLines);

        // Quote-Tweet Post has images and/or videos
        if(numOfQtImgs > 0 || numOfQtVideos > 0) {
            console.log('>>>>> twitter_canvas > Quote-Tweet Post has images and/or videos');
            const qtVidThumbnailUrl = qtMetadata.mediaExtended[0].thumbnail_url;
            const qtMainMedia1Url = qtMetadata.mediaUrls[0];
            const qtMainMedia1 = await loadImage(qtVidThumbnailUrl || qtMainMedia1Url);
            drawQtBasicElements(ctx, globalFont, qtMetadata, qtPfp, qtMainMedia1, {
                canvasHeightOffset: calculatedCanvasHeightFromDescLines,
                qtCanvasHeightOffset: qtCalculatedCanvasHeightFromDescLines,
                hasImgs,
                hasVids,
            });
        }
        // Quote-Tweet Post is text only
        if (numOfQtVideos === 0 && numOfQtImgs === 0) {
            console.log('>>>>> twitter_canvas > Quote-Tweet Post is text only');
            drawQtBasicElements(ctx, globalFont, qtMetadata, qtPfp, undefined, {
                canvasHeightOffset: calculatedCanvasHeightFromDescLines,
                qtCanvasHeightOffset: qtCalculatedCanvasHeightFromDescLines,
                hasImgs,
                hasVids,
            });
        }
    }

    if(qtMetadata?.error) {
        console.log('>>>>> twitter_canvas > Quote-Tweet Post is MISSING!');
        drawQtMissingStatus(
            ctx, globalFont, qtMetadata.message, {
                canvasHeightOffset: calculatedCanvasHeightFromDescLines,
                qtCanvasHeightOffset: qtCalculatedCanvasHeightFromDescLines,
                hasImgs: false,
                hasVids: false,
            }
        );
    }

    // Draw the Community Note, if exists
    // if(communityNote) {
    //     console.log('>>>>> twitter_canvas > drawing community note text...');
    //     drawCommunityNote(ctx, 30, calculatedCanvasHeightFromDescLines, communityNoteLines);
    // }

    // Draw the image, if one exists
    // this also handles if mixed-media gallary
    let firstMediaItem, firstMediaItemExt;
    if(metadataJson.mediaURLs.length > 0) {
        firstMediaItem = metadata.mediaExtended[0];
        firstMediaItemExt = getExtensionFromMediaUrl(firstMediaItem.thumbnail_url);
    }
    const acceptedExtensions = ['jpg', 'jpeg', 'png'];
    if (acceptedExtensions.includes(firstMediaItemExt)) {
        await renderImageGallery(
            ctx,
            metadata,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth,
            calculatedYPos,
        );
    }

    // Convert the canvas to a Buffer and return it
    return isImage ? canvas.toBuffer('image/png') : canvas.toBuffer();
};

module.exports = { createTwitterCanvas };
