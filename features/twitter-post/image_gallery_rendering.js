const {
    loadImage,
} = require('canvas');
const { cropSingleImage } = require('./crop_single_image.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');

const scaleToFitWiderThanHeight = (
    ctx,
    mainMedia1,
    yPosition,
    mediaMaxWidth,
) => {
    const newWidthRatio = mediaMaxWidth / mainMedia1.width;
    // console.log('>>>>> newWidthRatio: ', newWidthRatio);
    const adjustedHeight = mainMedia1.height * newWidthRatio;
    // console.log('>>>>> adjustedHeight: ', adjustedHeight);
    ctx.drawImage(mainMedia1, 20, yPosition, mediaMaxWidth, adjustedHeight);
};

/**
 * 
 * @param {*} ctx 
 * @param {*} metadata 
 * @param {*} calculatedCanvasHeightFromDescLines 
 * @param {*} heightShim 
 * @param {*} mediaMaxHeight 
 * @param {*} mediaMaxWidth 
 */
// const singleImage = async (
//     ctx,
//     metadata,
//     calculatedCanvasHeightFromDescLines,
//     heightShim,
//     mediaMaxHeight,
//     mediaMaxWidth,
// ) => {
//     const mainMedia1Url = metadata.mediaUrls[0];
//     const mainMedia1 = await loadImage(mainMedia1Url);
//     // const xPosition = 20;
//     const yPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
//     if (mainMedia1.width > mainMedia1.height) {
//         scaleToFitWiderThanHeight(ctx, mainMedia1, yPosition, mediaMaxWidth);
//     } else {
//         let mediaObject = {
//             height: metadata.mediaExtended[0].size.height,
//             width: metadata.mediaExtended[0].size.width,
//         };
//         console.log('>>>>> single image > mediaObject1: ', mediaObject);
//         mediaObject = scaleDownToFitAspectRatio(mediaObject, mediaMaxHeight, mediaMaxWidth);
//         console.log('>>>>> single image > mediaObject1: ', mediaObject);
//         console.log('>>>>> single image > mediaMaxHeight: ', mediaMaxHeight);
//         console.log('>>>>> single image > mediaMaxWidth: ', mediaMaxWidth);
        
//         /*
//         if maxWidth is 560, then X is the media width
//         center coordinate of maxWidth is maxWidth/2
//         then we need to "add" (or subject in this case to shift left):
//             mediaObject.width/2
//         then offset right 20 to fit padding
//         */
        
//         const firstXPosition = 20 + mediaMaxWidth/2 - mediaObject.width/2;
//         const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
//         ctx.drawImage(
//             mainMedia1,
//             firstXPosition, firstYPosition, mediaObject.width, mediaObject.height
//         );
//     }
// };
const singleImage = async (
    ctx,
    metadata,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth,
    cornerRadius = 15 // Default corner radius
) => {
    const mainMedia1Url = metadata.mediaUrls[0];
    const mainMedia1 = await loadImage(mainMedia1Url);
    const yPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;

    let mediaObject = {
        height: metadata.mediaExtended[0].size.height,
        width: metadata.mediaExtended[0].size.width,
    };

    mediaObject = scaleDownToFitAspectRatio(mediaObject, mediaMaxHeight, mediaMaxWidth);

    const firstXPosition = 20 + mediaMaxWidth / 2 - mediaObject.width / 2;
    const firstYPosition = yPosition;

    // Create a rounded rectangle path
    ctx.beginPath();
    ctx.moveTo(firstXPosition + cornerRadius, firstYPosition);
    ctx.lineTo(firstXPosition + mediaObject.width - cornerRadius, firstYPosition);
    ctx.quadraticCurveTo(
        firstXPosition + mediaObject.width,
        firstYPosition,
        firstXPosition + mediaObject.width,
        firstYPosition + cornerRadius
    );
    ctx.lineTo(firstXPosition + mediaObject.width, firstYPosition + mediaObject.height - cornerRadius);
    ctx.quadraticCurveTo(
        firstXPosition + mediaObject.width,
        firstYPosition + mediaObject.height,
        firstXPosition + mediaObject.width - cornerRadius,
        firstYPosition + mediaObject.height
    );
    ctx.lineTo(firstXPosition + cornerRadius, firstYPosition + mediaObject.height);
    ctx.quadraticCurveTo(
        firstXPosition,
        firstYPosition + mediaObject.height,
        firstXPosition,
        firstYPosition + mediaObject.height - cornerRadius
    );
    ctx.lineTo(firstXPosition, firstYPosition + cornerRadius);
    ctx.quadraticCurveTo(
        firstXPosition,
        firstYPosition,
        firstXPosition + cornerRadius,
        firstYPosition
    );
    ctx.closePath();

    // Apply the clip
    ctx.clip();

    // Draw the image inside the clipped path
    ctx.drawImage(
        mainMedia1,
        firstXPosition,
        firstYPosition,
        mediaObject.width,
        mediaObject.height
    );

    // Optionally, draw a border for the rounded rectangle
    ctx.strokeStyle = '#4d4d4d'; // Border color
    ctx.lineWidth = 2; // Border width
    ctx.stroke(); // Stroke the path
};


// REFACTOR with above
// (probably just replace it since we don't need to do an array search for a single img)
const singleVideoFrame = async (
    ctx,
    mediaUrl,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth,
) => {
    // console.log('>>>>> image_gallery_rendering > singleVideoFrame > mediaUrl: ', mediaUrl);
    const mainMedia1 = await loadImage(mediaUrl);
    const xPosition = 20;
    const yPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
    // TODO: We might not need to convert this into a Promise, but there's too much blackboxed behind `canvas/ctx` calls to chance it for now
    // ...Run load tests with a variety of different metadata/videos/concurrency later...
    return new Promise((resolve, reject) => {
        try {
            if (mainMedia1.width > mainMedia1.height) {
                scaleToFitWiderThanHeight(ctx, mainMedia1, yPosition, mediaMaxWidth);
                return resolve(true);
            } else {
                cropSingleImage(ctx, mainMedia1, mediaMaxHeight, mediaMaxWidth, xPosition, yPosition);
                return resolve(true);
            }
        }
        catch(err) {
            return reject(err);
        }
    });
};

/**
 * 
 * @param {*} ctx 
 * @param {*} metadata 
 * @param {*} calculatedCanvasHeightFromDescLines 
 * @param {*} heightShim 
 * @param {*} mediaMaxHeight 
 * @param {*} mediaMaxWidth 
 * @param {*} defaultYPosition 
 */
const renderImageGallery = async (
    ctx,
    metadata,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth,
    defaultYPosition,
) => {

    /**
     * TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO 
     * 
     * replace any instance of a media item in a list from the raw mp4 file
     * to the media_extended.video_thumbnail
     * 
     * TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO 
     */
    // If we've hit this point then we know all media items should be images
    // but in case they're not, then we must convert them all to it....
    // FIXME: this logic might have to happen before we call this, then, but for now
    // ... we can just fix it here
    const mediaItems = metadata.mediaExtended;
    const fixedMediaItems = mediaItems.map(mediaItem => {
        // Each mediaItem should have an associated JPG even if the source is a mp4 video...
        return mediaItem.thumbnail_url;
    });

    let mediaObject1 = {
        height: mediaItems[0].size.height,
        width: mediaItems[0].size.width,
    };
    const scaledMediaDimensions1 = scaleDownToFitAspectRatio(mediaObject1, mediaMaxHeight, mediaMaxWidth);
    // console.log('>>> scaledMediaDimensions1: ', scaledMediaDimensions1);

    /** Single Image */
    if(fixedMediaItems.length === 1) {
        await singleImage(
            ctx,
            metadata,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth,
        );
    }
    /** Two images */
    if(fixedMediaItems.length === 2) {
        const mainMedia1Url = fixedMediaItems[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, scaledMediaDimensions1.height, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = fixedMediaItems[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        /**
         * FIXME: This is a hack that forces it from a single (the first's) object's fixed
         * height since the "first img object" pattern is applied elsewhere throughout the
         * code — we need to refactor the entire codebase to determine min/max height for
         * ALL img objs and choose the appropriate one for each scenario...
         */
        cropSingleImage(ctx, mainMedia2, scaledMediaDimensions1.height, mediaMaxWidth / 2, secondXPosition, secondYPosition);
    }
    /** Three images */
    if(fixedMediaItems.length === 3) {
        console.log('>>> renderImageGallery > calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);
        console.log('>>> renderImageGallery > heightShim: ', heightShim);
        const mainMedia1Url = fixedMediaItems[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        console.log('>>> renderImageGallery > mainMedia1Url: ', mainMedia1Url);
        console.log('>>> renderImageGallery > firstXPosition: ', firstXPosition);
        console.log('>>> renderImageGallery > firstYPosition: ', firstYPosition);
        cropSingleImage(ctx, mainMedia1, scaledMediaDimensions1.height, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = fixedMediaItems[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        console.log('>>> renderImageGallery > mainMedia2Url: ', mainMedia2Url);
        console.log('>>> renderImageGallery > secondXPosition: ', secondXPosition);
        console.log('>>> renderImageGallery > secondYPosition: ', secondYPosition);
        cropSingleImage(ctx, mainMedia2, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

        const mainMedia3Url = fixedMediaItems[2];
        const mainMedia3 = await loadImage(mainMedia3Url);
        const thirdXPosition = mediaMaxWidth / 2 + 25;
        const thirdYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        console.log('>>> renderImageGallery > mainMedia3Url: ', mainMedia3Url);
        console.log('>>> renderImageGallery > thirdXPosition: ', thirdXPosition);
        console.log('>>> renderImageGallery > thirdYPosition: ', thirdYPosition);
        console.log('>>> renderImageGallery > scaledMediaDimensions1: ', scaledMediaDimensions1);
        console.log('>>> renderImageGallery > defaultYPosition: ', defaultYPosition);
        cropSingleImage(ctx, mainMedia3, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);
    }
    /** Four images */
    if(fixedMediaItems.length === 4) {
        const mainMedia1Url = fixedMediaItems[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = fixedMediaItems[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

        const mainMedia3Url = fixedMediaItems[2];
        const mainMedia3 = await loadImage(mainMedia3Url);
        const thirdXPosition = 20;
        const thirdYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia3, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);

        const mainMedia4Url = fixedMediaItems[3];
        const mainMedia4 = await loadImage(mainMedia4Url);
        const fourthXPosition = mediaMaxWidth / 2 + 25;
        const fourthYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia4, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, fourthXPosition, fourthYPosition);

    }
};

module.exports = {
    singleImage,
    singleVideoFrame,
    renderImageGallery,
};
