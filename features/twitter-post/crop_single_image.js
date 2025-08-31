// features/twitter-post/crop_single_image.js
const cropSingleImage = (ctx, mediaObject, maxWidth, maxHeight, xPosition, yPosition, opts = {}) => {
    const TAG = '[qt/cropSingleImage]';
    const { debugOverlay = true } = opts; // toggle overlay

    try {
    // Some image objects expose width/height vs videoWidth/videoHeight
        const srcW = Number(mediaObject.width) || Number(mediaObject.videoWidth) || null;
        const srcH = Number(mediaObject.height) || Number(mediaObject.videoHeight) || null;

        console.debug(`${TAG} ───────────────────────────────────────────────`);
        console.debug(`${TAG} INPUT media natural size: ${srcW} x ${srcH}`);
        console.debug(`${TAG} Destination slot (max): ${maxWidth} x ${maxHeight} @ (${xPosition}, ${yPosition})`);

        if (!srcW || !srcH) {
            console.warn(`${TAG} ERROR: missing natural size; aborting draw.`);
            return;
        }

        // crop from the center of the image
        const destAspectRatio = maxWidth / maxHeight;
        const srcAspectRatio = srcW / srcH;

        let cropWidth, cropHeight;

        if (srcAspectRatio > destAspectRatio) {
            // Image is wider than destination aspect ratio
            cropHeight = srcH;
            cropWidth = srcH * destAspectRatio;
            console.debug(`${TAG} case=WIDER: srcAspect=${srcAspectRatio.toFixed(3)} > destAspect=${destAspectRatio.toFixed(3)}`);
        } else {
            // Image is taller than destination aspect ratio
            cropWidth = srcW;
            cropHeight = srcW / destAspectRatio;
            console.debug(`${TAG} case=TALLER: srcAspect=${srcAspectRatio.toFixed(3)} <= destAspect=${destAspectRatio.toFixed(3)}`);
        }

        // Calculate starting point (top left corner) for cropping
        const sx = (srcW - cropWidth) / 2;
        const sy = (srcH - cropHeight) / 2;

        console.debug(`${TAG} Computed crop rect (source coords):`);
        console.debug(`${TAG}   sx=${sx}, sy=${sy}, cropWidth=${cropWidth}, cropHeight=${cropHeight}`);
        console.debug(`${TAG} Final drawImage params:`);
        console.debug(`${TAG}   srcRect: (${sx}, ${sy}, ${cropWidth}, ${cropHeight})`);
        console.debug(`${TAG}   dstRect: (${xPosition}, ${yPosition}, ${maxWidth}, ${maxHeight})`);

        // Draw the cropped image on the canvas
        ctx.drawImage(
            mediaObject,
            sx, sy, cropWidth, cropHeight, // Source rectangle
            xPosition, yPosition, maxWidth, maxHeight // Destination rectangle
        );

        console.debug(`${TAG} drawImage complete.`);

        // Optional debug overlay
        if (debugOverlay) {
            try {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.65)'; // semi-transparent red
                ctx.lineWidth = 2;
                ctx.strokeRect(xPosition, yPosition, maxWidth, maxHeight);
                ctx.restore();
                console.debug(`${TAG} overlay strokeRect drawn around dstRect`);
            } catch (overlayErr) {
                console.warn(`${TAG} overlay draw failed:`, overlayErr);
            }
        }

        console.debug(`${TAG} ───────────────────────────────────────────────`);
    } catch (err) {
        console.warn(`${TAG} ERROR during crop:`, err);
    }
};

module.exports = { cropSingleImage };
