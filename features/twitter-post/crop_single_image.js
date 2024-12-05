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

    // Create a clipping path with rounded corners
    const cornerRadius = 25;
    ctx.save(); // Save the current context state
    ctx.beginPath();
    ctx.moveTo(xPosition + cornerRadius, yPosition); // Start at the top-left corner
    ctx.lineTo(xPosition + maxWidth - cornerRadius, yPosition); // Top-right corner
    ctx.quadraticCurveTo(xPosition + maxWidth, yPosition, xPosition + maxWidth, yPosition + cornerRadius); // Top-right curve
    ctx.lineTo(xPosition + maxWidth, yPosition + maxHeight - cornerRadius); // Bottom-right corner
    ctx.quadraticCurveTo(xPosition + maxWidth, yPosition + maxHeight, xPosition + maxWidth - cornerRadius, yPosition + maxHeight); // Bottom-right curve
    ctx.lineTo(xPosition + cornerRadius, yPosition + maxHeight); // Bottom-left corner
    ctx.quadraticCurveTo(xPosition, yPosition + maxHeight, xPosition, yPosition + maxHeight - cornerRadius); // Bottom-left curve
    ctx.lineTo(xPosition, yPosition + cornerRadius); // Top-left corner
    ctx.quadraticCurveTo(xPosition, yPosition, xPosition + cornerRadius, yPosition); // Top-left curve
    ctx.closePath();
    ctx.clip(); // Apply the clipping path

    // Draw the cropped image on the canvas
    ctx.drawImage(
        mainMedia1,
        sx, sy, cropWidth, cropHeight, // Source rectangle
        xPosition, yPosition, maxWidth, maxHeight // Destination rectangle
    );
};

module.exports = { cropSingleImage };
