const scaleDownToFitAspectRatio = (
    { height, width },
    mediaMaxHeight,
    mediaMaxWidth,
    compensatedHeight,
) => {
    const aspectRatio = width / height;

    if (width > mediaMaxWidth) {
        width = mediaMaxWidth;
        height = Math.floor(mediaMaxWidth / aspectRatio);
    }

    if (height > (mediaMaxHeight - compensatedHeight)) {
        height = (mediaMaxHeight - compensatedHeight);
        width = Math.floor((mediaMaxHeight - compensatedHeight) * aspectRatio);
    }

    return {
        height,
        width,
    };
};


module.exports = {
    scaleDownToFitAspectRatio,
};


