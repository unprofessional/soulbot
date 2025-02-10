const cropSingleImage = (ctx, mediaObject, maxHeight, maxWidth, xPosition, yPosition) => {
    /** CROPPING LOGIC */
    // crop from the center of the image
    // Calculate the aspect ratio of the destination size
    const destAspectRatio = maxWidth / maxHeight;
    // Determine the cropping size (maintaining the destination aspect ratio)
    let cropWidth, cropHeight;
    if (mediaObject.width / mediaObject.height > destAspectRatio) {
        // Image is wider than destination aspect ratio
        cropHeight = mediaObject.height;
        cropWidth = mediaObject.height * destAspectRatio;
    } else {
        // Image is taller than destination aspect ratio
        cropWidth = mediaObject.width;
        cropHeight = mediaObject.width / destAspectRatio;
    }
    // Calculate starting point (top left corner) for cropping
    const sx = (mediaObject.width - cropWidth) / 2;
    const sy = (mediaObject.height - cropHeight) / 2;
    // Draw the cropped image on the canvas
    ctx.drawImage(
        mediaObject,
        sx, sy, cropWidth, cropHeight, // Source rectangle
        xPosition, yPosition, maxWidth, maxHeight // Destination rectangle
    );
};

module.exports = { cropSingleImage };
