const {
    loadImage,
} = require('canvas');
const { cropSingleImage } = require('./crop_single_image.js');

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
const singleImage = async (
    ctx,
    metadata,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth,
) => {
    const mainMedia1Url = metadata.mediaUrls[0];
    const mainMedia1 = await loadImage(mainMedia1Url);
    const xPosition = 20;
    const yPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
    if (mainMedia1.width > mainMedia1.height) {
        scaleToFitWiderThanHeight(ctx, mainMedia1, yPosition, mediaMaxWidth);
    } else {
        cropSingleImage(ctx, mainMedia1, mediaMaxHeight, mediaMaxWidth, xPosition, yPosition);
    }
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
        cropSingleImage(ctx, mainMedia1, mediaMaxHeight, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = metadata.mediaUrls[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, mediaMaxHeight, mediaMaxWidth / 2, secondXPosition, secondYPosition);
    }
    /** Three images */
    if(metadata.mediaUrls.length === 3) {
        const mainMedia1Url = metadata.mediaUrls[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, mediaMaxHeight, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = metadata.mediaUrls[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, mediaMaxHeight / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

        const mainMedia3Url = metadata.mediaUrls[2];
        const mainMedia3 = await loadImage(mainMedia3Url);
        const thirdXPosition = mediaMaxWidth / 2 + 25;
        const thirdYPosition = mediaMaxHeight / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia3, mediaMaxHeight / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);
    }
    /** Four images */
    if(metadata.mediaUrls.length === 4) {
        const mainMedia1Url = metadata.mediaUrls[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, mediaMaxHeight / 2, mediaMaxWidth / 2, firstXPosition, firstYPosition);

        const mainMedia2Url = metadata.mediaUrls[1];
        const mainMedia2 = await loadImage(mainMedia2Url);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, mediaMaxHeight / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

        const mainMedia3Url = metadata.mediaUrls[2];
        const mainMedia3 = await loadImage(mainMedia3Url);
        const thirdXPosition = 20;
        const thirdYPosition = mediaMaxHeight / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia3, mediaMaxHeight / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);

        const mainMedia4Url = metadata.mediaUrls[3];
        const mainMedia4 = await loadImage(mainMedia4Url);
        const fourthXPosition = mediaMaxWidth / 2 + 25;
        const fourthYPosition = mediaMaxHeight / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia4, mediaMaxHeight / 2, mediaMaxWidth / 2, fourthXPosition, fourthYPosition);

    }
};

module.exports = {
    singleImage,
    singleVideoFrame,
    renderImageGallery,
};