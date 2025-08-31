// features/twitter-post/render_image_gallery.js
const { loadImage } = require('canvas');
const { cropSingleImage } = require('./crop_single_image.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');

const scaleToFitWiderThanHeight = (
    ctx,
    mainMedia1,
    yPosition,
    mediaMaxWidth
) => {
    const newWidthRatio = mediaMaxWidth / mainMedia1.width;
    const adjustedHeight = mainMedia1.height * newWidthRatio;
    ctx.drawImage(mainMedia1, 20, yPosition, mediaMaxWidth, adjustedHeight);
};

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

    mediaObject = scaleDownToFitAspectRatio(
        mediaObject,
        mediaMaxHeight,
        mediaMaxWidth
    );

    const firstXPosition = 20 + mediaMaxWidth / 2 - mediaObject.width / 2;
    const firstYPosition = yPosition;

    ctx.beginPath();
    ctx.moveTo(firstXPosition + cornerRadius, firstYPosition);
    ctx.lineTo(
        firstXPosition + mediaObject.width - cornerRadius,
        firstYPosition
    );
    ctx.quadraticCurveTo(
        firstXPosition + mediaObject.width,
        firstYPosition,
        firstXPosition + mediaObject.width,
        firstYPosition + cornerRadius
    );
    ctx.lineTo(
        firstXPosition + mediaObject.width,
        firstYPosition + mediaObject.height - cornerRadius
    );
    ctx.quadraticCurveTo(
        firstXPosition + mediaObject.width,
        firstYPosition + mediaObject.height,
        firstXPosition + mediaObject.width - cornerRadius,
        firstYPosition + mediaObject.height
    );
    ctx.lineTo(
        firstXPosition + cornerRadius,
        firstYPosition + mediaObject.height
    );
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

    ctx.clip();

    ctx.drawImage(
        mainMedia1,
        firstXPosition,
        firstYPosition,
        mediaObject.width,
        mediaObject.height
    );

    ctx.strokeStyle = '#4d4d4d';
    ctx.lineWidth = 2;
    ctx.stroke();
};

const singleVideoFrame = async (
    ctx,
    mediaUrl,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth
) => {
    const mainMedia1 = await loadImage(mediaUrl);
    const xPosition = 20;
    const yPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
    return new Promise((resolve, reject) => {
        try {
            if (mainMedia1.width > mainMedia1.height) {
                scaleToFitWiderThanHeight(ctx, mainMedia1, yPosition, mediaMaxWidth);
                return resolve(true);
            } else {
                cropSingleImage(ctx, mainMedia1, mediaMaxWidth, mediaMaxHeight, xPosition, yPosition, { tag: 'gallery/video' });
                return resolve(true);
            }
        } catch (err) {
            return reject(err);
        }
    });
};

const renderImageGallery = async (
    ctx,
    metadata,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth,
    defaultYPosition
) => {
    console.log('>>>>> renderImageGallery reached!');

    const mediaItems = metadata.mediaExtended;
    const fixedMediaItems = mediaItems.map(mediaItem => mediaItem.thumbnail_url);

    let mediaObject1 = {
        height: mediaItems[0].size.height,
        width: mediaItems[0].size.width,
    };
    const scaledMediaDimensions1 = scaleDownToFitAspectRatio(
        mediaObject1,
        mediaMaxHeight,
        mediaMaxWidth
    );

    /** Single Image */
    if (fixedMediaItems.length === 1) {
        await singleImage(
            ctx,
            metadata,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth
        );
    }

    /** Two images */
    if (fixedMediaItems.length === 2) {
        const mainMedia1 = await loadImage(fixedMediaItems[0]);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, mediaMaxWidth / 2, scaledMediaDimensions1.height, firstXPosition, firstYPosition, { tag: 'gallery/2-left' });

        const mainMedia2 = await loadImage(fixedMediaItems[1]);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, mediaMaxWidth / 2, scaledMediaDimensions1.height, secondXPosition, secondYPosition, { tag: 'gallery/2-right' });
    }

    /** Three images */
    if (fixedMediaItems.length === 3) {
        const mainMedia1 = await loadImage(fixedMediaItems[0]);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, mediaMaxWidth / 2, scaledMediaDimensions1.height, firstXPosition, firstYPosition, { tag: 'gallery/3-top-left' });

        const mainMedia2 = await loadImage(fixedMediaItems[1]);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, mediaMaxWidth / 2, scaledMediaDimensions1.height / 2, secondXPosition, secondYPosition, { tag: 'gallery/3-top-right' });

        const mainMedia3 = await loadImage(fixedMediaItems[2]);
        const thirdXPosition = mediaMaxWidth / 2 + 25;
        const thirdYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia3, mediaMaxWidth / 2, scaledMediaDimensions1.height / 2, thirdXPosition, thirdYPosition, { tag: 'gallery/3-bottom-right' });
    }

    /** Four images */
    if (fixedMediaItems.length === 4) {
        const mainMedia1 = await loadImage(fixedMediaItems[0]);
        const firstXPosition = 20;
        const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia1, mediaMaxWidth / 2, scaledMediaDimensions1.height / 2, firstXPosition, firstYPosition, { tag: 'gallery/4-top-left' });

        const mainMedia2 = await loadImage(fixedMediaItems[1]);
        const secondXPosition = mediaMaxWidth / 2 + 25;
        const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        cropSingleImage(ctx, mainMedia2, mediaMaxWidth / 2, scaledMediaDimensions1.height / 2, secondXPosition, secondYPosition, { tag: 'gallery/4-top-right' });

        const mainMedia3 = await loadImage(fixedMediaItems[2]);
        const thirdXPosition = 20;
        const thirdYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia3, mediaMaxWidth / 2, scaledMediaDimensions1.height / 2, thirdXPosition, thirdYPosition, { tag: 'gallery/4-bottom-left' });

        const mainMedia4 = await loadImage(fixedMediaItems[3]);
        const fourthXPosition = mediaMaxWidth / 2 + 25;
        const fourthYPosition = scaledMediaDimensions1.height / 2 + defaultYPosition - 5;
        cropSingleImage(ctx, mainMedia4, mediaMaxWidth / 2, scaledMediaDimensions1.height / 2, fourthXPosition, fourthYPosition, { tag: 'gallery/4-bottom-right' });
    }
};

module.exports = {
    singleImage,
    singleVideoFrame,
    renderImageGallery,
};
