const scaleDownToFitAspectRatio = (
    { height, width },
    mediaMaxHeight,
    mediaMaxWidth,
    compensatedHeight = 0
) => {
    // Calculate the effective maximum height, ensuring it is not negative
    const effectiveMaxHeight = Math.max(0, mediaMaxHeight - compensatedHeight);

    // Calculate scaling factors for both width and height limits
    const widthScale = mediaMaxWidth / width;
    const heightScale = effectiveMaxHeight / height;
    const scaleFactor = Math.min(widthScale, heightScale);

    // Scale dimensions using the calculated scaleFactor, preserving aspect ratio
    const adjustedWidth = Math.floor(width * scaleFactor);
    const adjustedHeight = Math.floor(height * scaleFactor);

    return {
        height: adjustedHeight,
        width: adjustedWidth,
    };
};

module.exports = {
    scaleDownToFitAspectRatio,
};
