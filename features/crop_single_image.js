const cropSingleImage = (ctx, mainMedia1, maxHeight, maxWidth, xPosition, yPosition) => {
    /** CROPPING LOGIC */
    // crop from the center of the image
    // Calculate the aspect ratio of the destination size
    const destAspectRatio = maxWidth / maxHeight;
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
        xPosition, yPosition, maxWidth, maxHeight // Destination rectangle
    );
};

module.exports = { cropSingleImage };
