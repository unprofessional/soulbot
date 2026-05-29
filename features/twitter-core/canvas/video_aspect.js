// features/twitter-core/canvas/video_aspect.js

const { scaleDownToFitAspectRatio } = require('../../twitter-post/scale_down');

function getAdjustedAspectRatios(canvasWidth, canvasHeight, videoWidth, videoHeight, heightShim) {
    const even = n => Math.ceil(n / 2) * 2;
    const mediaObject = { width: even(videoWidth), height: even(videoHeight) };
    const adjustedCanvasWidth = even(canvasWidth);
    const adjustedCanvasHeight = even(canvasHeight);
    const scaled = scaleDownToFitAspectRatio(
        mediaObject,
        adjustedCanvasHeight,
        adjustedCanvasWidth,
        canvasHeight - heightShim
    );

    return {
        adjustedCanvasWidth,
        adjustedCanvasHeight,
        scaledDownObjectWidth: scaled.width,
        scaledDownObjectHeight: scaled.height,
        overlayX: (canvasWidth - scaled.width) / 2,
        overlayY: canvasHeight - heightShim - 50,
    };
}

module.exports = { getAdjustedAspectRatios };
