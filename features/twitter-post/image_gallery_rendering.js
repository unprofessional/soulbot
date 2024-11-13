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
    cornerRadius = 20 // Default corner radius
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
    ctx.strokeStyle = 'gray'; // Border color
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

    let mediaObject1 = {
        height: metadata.mediaExtended[0].size.height,
        width: metadata.mediaExtended[0].size.width,
    };
    const scaledMediaDimensions1 = scaleDownToFitAspectRatio(mediaObject1, mediaMaxHeight, mediaMaxWidth);
    // console.log('>>> scaledMediaDimensions1: ', scaledMediaDimensions1);

    /** Single Image */
    if(metadata.mediaUrls.length === 1) {
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
    if(metadata.mediaUrls.length === 2) {
        const mainMedia1Url = metadata.mediaUrls[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, scaledMediaDimensions1.height, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = metadata.mediaUrls[1];
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
    if(metadata.mediaUrls.length === 3) {
        const mainMedia1Url = metadata.mediaUrls[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, scaledMediaDimensions1.height, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = metadata.mediaUrls[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

        const mainMedia3Url = metadata.mediaUrls[2];
        const mainMedia3 = await loadImage(mainMedia3Url);
        const thirdXPosition = mediaMaxWidth / 2 + 25;
        const thirdYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia3, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);
    }
    /** Four images */
    if(metadata.mediaUrls.length === 4) {
        const mainMedia1Url = metadata.mediaUrls[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = metadata.mediaUrls[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

        const mainMedia3Url = metadata.mediaUrls[2];
        const mainMedia3 = await loadImage(mainMedia3Url);
        const thirdXPosition = 20;
        const thirdYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia3, scaledMediaDimensions1.height / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);

        const mainMedia4Url = metadata.mediaUrls[3];
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
