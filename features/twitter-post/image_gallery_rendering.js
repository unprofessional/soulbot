// features/twitter-post/render_image_gallery.js
const { loadImage } = require('canvas');
const { cropSingleImage } = require('./crop_single_image.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');

// layout constants
const LEFT_X = 20;           // left margin
const COL_GUTTER_X = 25;     // space between left/right columns
const ROW_GUTTER_Y = 10;     // space between stacked tiles in right column

const scaleToFitWiderThanHeight = (ctx, mainMedia1, yPosition, mediaMaxWidth) => {
    const newWidthRatio = mediaMaxWidth / mainMedia1.width;
    const adjustedHeight = mainMedia1.height * newWidthRatio;
    ctx.drawImage(mainMedia1, LEFT_X, yPosition, mediaMaxWidth, adjustedHeight);
};

const singleImage = async (
    ctx,
    metadata,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth,
    cornerRadius = 15
) => {
    const mainMedia1Url = metadata.mediaUrls[0];
    const mainMedia1 = await loadImage(mainMedia1Url);
    const yPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;

    let mediaObject = {
        height: metadata.mediaExtended[0].size.height,
        width: metadata.mediaExtended[0].size.width,
    };

    mediaObject = scaleDownToFitAspectRatio(mediaObject, mediaMaxHeight, mediaMaxWidth);

    const firstXPosition = LEFT_X + mediaMaxWidth / 2 - mediaObject.width / 2;
    const firstYPosition = yPosition;

    // rounded-rect clip
    ctx.beginPath();
    ctx.moveTo(firstXPosition + cornerRadius, firstYPosition);
    ctx.lineTo(firstXPosition + mediaObject.width - cornerRadius, firstYPosition);
    ctx.quadraticCurveTo(firstXPosition + mediaObject.width, firstYPosition, firstXPosition + mediaObject.width, firstYPosition + cornerRadius);
    ctx.lineTo(firstXPosition + mediaObject.width, firstYPosition + mediaObject.height - cornerRadius);
    ctx.quadraticCurveTo(firstXPosition + mediaObject.width, firstYPosition + mediaObject.height, firstXPosition + mediaObject.width - cornerRadius, firstYPosition + mediaObject.height);
    ctx.lineTo(firstXPosition + cornerRadius, firstYPosition + mediaObject.height);
    ctx.quadraticCurveTo(firstXPosition, firstYPosition + mediaObject.height, firstXPosition, firstYPosition + mediaObject.height - cornerRadius);
    ctx.lineTo(firstXPosition, firstYPosition + cornerRadius);
    ctx.quadraticCurveTo(firstXPosition, firstYPosition, firstXPosition + cornerRadius, firstYPosition);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(mainMedia1, firstXPosition, firstYPosition, mediaObject.width, mediaObject.height);

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
    const xPosition = LEFT_X;
    const yPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;

    return new Promise((resolve, reject) => {
        try {
            if (mainMedia1.width > mainMedia1.height) {
                scaleToFitWiderThanHeight(ctx, mainMedia1, yPosition, mediaMaxWidth);
                resolve(true);
            } else {
                cropSingleImage(ctx, mainMedia1, mediaMaxWidth, mediaMaxHeight, xPosition, yPosition, { tag: 'gallery/video' });
                resolve(true);
            }
        } catch (err) {
            reject(err);
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
    const fixedMediaItems = mediaItems.map(m => m.thumbnail_url);

    // baseline scale from first media (keeps behavior the same)
    const mediaObject1 = {
        height: mediaItems[0].size.height,
        width: mediaItems[0].size.width,
    };
    const scaledMediaDimensions1 = scaleDownToFitAspectRatio(mediaObject1, mediaMaxHeight, mediaMaxWidth);

    // ===== 1 image =====
    if (fixedMediaItems.length === 1) {
        await singleImage(
            ctx,
            metadata,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth
        );
        return;
    }

    // common positions/sizes
    const yBase = calculatedCanvasHeightFromDescLines - heightShim - 50;
    const colW = mediaMaxWidth / 2;

    // ===== 2 images (side-by-side, matched height) =====
    if (fixedMediaItems.length === 2) {
        const img1 = await loadImage(fixedMediaItems[0]);
        const img2 = await loadImage(fixedMediaItems[1]);

        const h = scaledMediaDimensions1.height; // keep prior behavior: use first's scaled height

        cropSingleImage(ctx, img1, colW, h, LEFT_X, yBase, { tag: 'gallery/2-left' });
        cropSingleImage(ctx, img2, colW, h, LEFT_X + colW + COL_GUTTER_X, yBase, { tag: 'gallery/2-right' });
        return;
    }

    // ===== 3 images (balanced) =====
    if (fixedMediaItems.length === 3) {
        const img1 = await loadImage(fixedMediaItems[0]); // left
        const img2 = await loadImage(fixedMediaItems[1]); // right/top
        const img3 = await loadImage(fixedMediaItems[2]); // right/bottom

        // left column height per legacy scaling logic
        const leftColHeight = scaledMediaDimensions1.height;

        // right column gets two tiles that sum to leftColHeight, with a gutter
        const rightTileHeight = Math.round((leftColHeight - ROW_GUTTER_Y) / 2);

        // left tile
        cropSingleImage(ctx, img1, colW, leftColHeight, LEFT_X, yBase, { tag: 'gallery/3-left' });

        // right/top
        const rightX = LEFT_X + colW + COL_GUTTER_X;
        const rightTopY = yBase;
        cropSingleImage(ctx, img2, colW, rightTileHeight, rightX, rightTopY, { tag: 'gallery/3-right-top' });

        // right/bottom
        const rightBotY = rightTopY + rightTileHeight + ROW_GUTTER_Y;
        cropSingleImage(ctx, img3, colW, rightTileHeight, rightX, rightBotY, { tag: 'gallery/3-right-bot' });
        return;
    }

    // ===== 4 images (2x2 grid) =====
    if (fixedMediaItems.length === 4) {
        const [img1, img2, img3, img4] = await Promise.all(fixedMediaItems.map(loadImage));

        const tileH = Math.round(scaledMediaDimensions1.height / 2);

        // top row
        cropSingleImage(ctx, img1, colW, tileH, LEFT_X, yBase, { tag: 'gallery/4-tl' });
        cropSingleImage(ctx, img2, colW, tileH, LEFT_X + colW + COL_GUTTER_X, yBase, { tag: 'gallery/4-tr' });

        // bottom row
        const row2Y = yBase + tileH + ROW_GUTTER_Y;
        cropSingleImage(ctx, img3, colW, tileH, LEFT_X, row2Y, { tag: 'gallery/4-bl' });
        cropSingleImage(ctx, img4, colW, tileH, LEFT_X + colW + COL_GUTTER_X, row2Y, { tag: 'gallery/4-br' });
    }
};

module.exports = {
    singleImage,
    singleVideoFrame,
    renderImageGallery,
};
