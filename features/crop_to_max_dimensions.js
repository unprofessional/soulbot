const { loadImage } = require('canvas');

const cropToMaxDimensions = async (
    mediaUrls,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxWidth,
    mediaMaxHeight,
    ctx,
) => {
    const mainMedia1Url = mediaUrls[0];
    const mainMedia1 = await loadImage(mainMedia1Url);
    /** CROPPING LOGIC */
    const position = calculatedCanvasHeightFromDescLines - heightShim - 50;
    if (mainMedia1.width > mainMedia1.height) {
        // scale to fit width and draw like normal
        const newWidthRatio = mediaMaxWidth / mainMedia1.width;
        console.log('>>>>> newWidthRatio: ', newWidthRatio);
        const adjustedHeight = mainMedia1.height * newWidthRatio;
        console.log('>>>>> adjustedHeight: ', adjustedHeight);
        ctx.drawImage(
            mainMedia1,
            // sx, sy, cropWidth, cropHeight, // Source rectangle
            20, position, mediaMaxWidth, adjustedHeight // Destination rectangle
        );
    } else {
        // crop from the center of the image
        // Calculate the aspect ratio of the destination size
        const destAspectRatio = mediaMaxWidth / mediaMaxHeight;
        // Determine the cropping size (maintaining the destination aspect ratio)
        let cropWidth, cropHeight;
        if (mainMedia1.width / mainMedia1.height > destAspectRatio) {
            // Image is wider than destination aspect ratio
            cropHeight = mainMedia1.height;
            cropWidth = mainMedia1.height * destAspectRatio;
        } else {
            // Image is taller than destination aspect ratio
            cropWidth = mainMedia1.width;
            cropHeight = mainMedia1.width / destAspectRatio;
        }
        // Calculate starting point (top left corner) for cropping
        const sx = (mainMedia1.width - cropWidth) / 2;
        const sy = (mainMedia1.height - cropHeight) / 2;
        // Draw the cropped image on the canvas
        ctx.drawImage(
            mainMedia1,
            sx, sy, cropWidth, cropHeight, // Source rectangle
            20, position, mediaMaxWidth, mediaMaxHeight // Destination rectangle
        );
    }
}

module.exports = {
    cropToMaxDimensions,
};
