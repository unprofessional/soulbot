// features/twitter-post/crop_single_image.js
function cropSingleImage(ctx, mediaObject, maxWidth, maxHeight, xPosition, yPosition, opts = {}) {
    const TAG = opts.tag || 'qt/cropSingleImage';
    const debugOverlay = opts.debugOverlay ?? (process.env.DEBUG_QT === '1');

    try {
        const srcW = Number(mediaObject.width) || Number(mediaObject.videoWidth) || null;
        const srcH = Number(mediaObject.height) || Number(mediaObject.videoHeight) || null;

        if (!srcW || !srcH) {
            console.warn(`[${TAG}] Missing natural size; type=${mediaObject?.constructor?.name}`);
            return;
        }

        let W = Number(maxWidth);
        let H = Number(maxHeight);

        // Guard zero/NaN
        if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) {
            console.warn(`[${TAG}] Bad dst size W×H=${W}×${H}; abort`);
            return;
        }

        const log = (...a) => (process.env.DEBUG_QT === '1' ? console.debug(`[${TAG}]`, ...a) : void 0);
        log('SRC', `${srcW}x${srcH}`, 'DST', `${W}x${H}`, '@', `(${xPosition},${yPosition})`);

        // Core math bundled for reuse (and to support legacy swap retry)
        const compute = (w, h) => {
            const destAspect = w / h;
            const srcAspect = srcW / srcH;
            let cropW, cropH;

            if (srcAspect > destAspect) {
                cropH = srcH;
                cropW = srcH * destAspect;
            } else {
                cropW = srcW;
                cropH = srcW / destAspect;
            }

            let sx = (srcW - cropW) / 2;
            let sy = (srcH - cropH) / 2;

            return { destAspect, cropW, cropH, sx, sy };
        };

        let { destAspect, cropW, cropH, sx, sy } = compute(W, H);

        // Legacy-order auto-detect: if we computed a crop bigger than the source, try swapping W/H once.
        const tooWide = cropW > srcW + 0.5;
        const tooTall = cropH > srcH + 0.5;
        if (tooWide || tooTall) {
            log('Legacy arg order suspected; swapping W/H.');
            [W, H] = [H, W];
            ({ destAspect, cropW, cropH, sx, sy } = compute(W, H));
        }

        // Clamp crop rect into the source bounds (avoid negatives / overflow)
        if (sx < 0) { cropW += sx; sx = 0; }
        if (sy < 0) { cropH += sy; sy = 0; }
        cropW = Math.max(1, Math.min(cropW, srcW - sx));
        cropH = Math.max(1, Math.min(cropH, srcH - sy));

        log('srcAspect=', (srcW / srcH).toFixed(3), 'destAspect=', destAspect.toFixed(3));
        log('srcRect', `(${sx}, ${sy}, ${cropW}, ${cropH})`);
        log('dstRect', `(${xPosition}, ${yPosition}, ${W}, ${H})`);

        // Draw
        ctx.drawImage(
            mediaObject,
            sx, sy, cropW, cropH,
            xPosition, yPosition, W, H
        );

        // Optional overlay of the destination rect
        if (debugOverlay) {
            try {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.65)';
                ctx.lineWidth = 2;
                ctx.strokeRect(xPosition, yPosition, W, H);
                ctx.restore();
                log('overlay strokeRect drawn');
            } catch (e) {
                console.warn(`[${TAG}] overlay failed:`, e);
            }
        }
    } catch (err) {
        console.warn(`[${TAG}] ERROR:`, err);
    }
}

module.exports = { cropSingleImage };
