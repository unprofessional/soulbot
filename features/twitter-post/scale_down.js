const scaleDownToFitAspectRatio = (
    { height, width },
    mediaMaxHeight,
    mediaMaxWidth,
    compensatedHeight = 0
) => {
    console.log('>>>>> scaleDownToFitAspectRatio > height: ', height);
    console.log('>>>>> scaleDownToFitAspectRatio > width: ', width);
    console.log('>>>>> scaleDownToFitAspectRatio > mediaMaxHeight: ', mediaMaxHeight);
    console.log('>>>>> scaleDownToFitAspectRatio > mediaMaxWidth: ', mediaMaxWidth);
    console.log('>>>>> scaleDownToFitAspectRatio > compensatedHeight: ', compensatedHeight);
    // Calculate the effective maximum height, ensuring it is not negative
    const effectiveMaxHeight = Math.max(0, mediaMaxHeight - compensatedHeight);
    console.log('>>>>> scaleDownToFitAspectRatio > effectiveMaxHeight: ', effectiveMaxHeight);

    // Calculate scaling factors for both width and height limits
    const widthScale = mediaMaxWidth / width;
    const heightScale = effectiveMaxHeight / height;
    const scaleFactor = Math.min(widthScale, heightScale);
    console.log('>>>>> scaleDownToFitAspectRatio > widthScale: ', widthScale);
    console.log('>>>>> scaleDownToFitAspectRatio > heightScale: ', heightScale);
    console.log('>>>>> scaleDownToFitAspectRatio > scaleFactor: ', scaleFactor);

    // Scale dimensions using the calculated scaleFactor, preserving aspect ratio
    const adjustedWidth = Math.floor(width * scaleFactor);
    const adjustedHeight = Math.floor(height * scaleFactor);
    console.log('>>>>> scaleDownToFitAspectRatio > adjustedWidth: ', adjustedWidth);
    console.log('>>>>> scaleDownToFitAspectRatio > adjustedHeight: ', adjustedHeight);

    return {
        height: adjustedHeight,
        width: adjustedWidth,
    };
};

module.exports = {
    scaleDownToFitAspectRatio,
};
