// features/twitter-post/image_gallery_rendering.js
/* eslint-disable no-empty */
const { createCanvas, loadImage } = require('canvas');
const { cropSingleImage } = require('./crop_single_image.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');

// features/twitter-post/image_gallery_rendering.js

// ...existing imports...

// Layout constants
const LEFT_X = 20;
const MAX_COMBINED_RENDER_WIDTH = 2600;
const BLUR_DOWNSAMPLE_FACTOR = 14;

// Helpers --------------------------------------------------------------------

function getItems(metadata) {
    const items = Array.isArray(metadata?.mediaExtended) ? metadata.mediaExtended : [];
    // Prefer images; if mixed, keep images only
    const images = items.filter(m => (m?.type || '').toLowerCase() === 'image');
    return images.length ? images : items;
}

function getUrl(m) {
    return m?.thumbnail_url || m?.url || null;
}

function getSize(m) {
    const w = m?.size?.width ?? m?.width ?? null;
    const h = m?.size?.height ?? m?.height ?? null;
    return (w && h) ? { width: w, height: h } : null;
}

function getImageSize(image) {
    const w = Number(image?.width) || Number(image?.videoWidth) || null;
    const h = Number(image?.height) || Number(image?.videoHeight) || null;
    return (w && h) ? { width: w, height: h } : null;
}

function findLargestItem(items) {
    return items.reduce((largest, item) => {
        const size = getSize(item);
        if (!size) return largest;
        if (!largest) return item;
        const largestSize = getSize(largest);
        return size.width * size.height > largestSize.width * largestSize.height
            ? item
            : largest;
    }, null);
}

function getCombinedNaturalSize(items) {
    const largest = findLargestItem(items);
    const largestSize = largest ? getSize(largest) : null;
    if (!largestSize) return null;

    if (items.length === 1) return largestSize;
    if (items.length === 2) {
        return {
            width: largestSize.width * 2,
            height: largestSize.height,
        };
    }

    return {
        width: largestSize.width * 2,
        height: largestSize.height * 2,
    };
}

function fitWithinBox(source, maxWidth, maxHeight) {
    if (!source?.width || !source?.height) return { width: maxWidth, height: maxHeight };

    const scale = Math.min(maxWidth / source.width, maxHeight / source.height, 1);
    return {
        width: Math.max(1, Math.round(source.width * scale)),
        height: Math.max(1, Math.round(source.height * scale)),
    };
}

function containRect(srcW, srcH, dstX, dstY, dstW, dstH) {
    const scale = Math.min(dstW / srcW, dstH / srcH);
    const w = srcW * scale;
    const h = srcH * scale;
    return {
        x: dstX + (dstW - w) / 2,
        y: dstY + (dstH - h) / 2,
        width: w,
        height: h,
    };
}

function coverRect(srcW, srcH, dstX, dstY, dstW, dstH) {
    const scale = Math.max(dstW / srcW, dstH / srcH);
    const w = srcW * scale;
    const h = srcH * scale;
    return {
        x: dstX + (dstW - w) / 2,
        y: dstY + (dstH - h) / 2,
        width: w,
        height: h,
    };
}

function getTileRects(count, totalWidth, totalHeight) {
    if (count <= 1) {
        return [{ x: 0, y: 0, width: totalWidth, height: totalHeight }];
    }

    if (count === 2) {
        const tileW = totalWidth / 2;
        return [
            { x: 0, y: 0, width: tileW, height: totalHeight },
            { x: tileW, y: 0, width: tileW, height: totalHeight },
        ];
    }

    const tileW = totalWidth / 2;
    const tileH = totalHeight / 2;
    const rects = [
        { x: 0, y: 0, width: tileW, height: tileH },
        { x: tileW, y: 0, width: tileW, height: tileH },
    ];

    if (count === 3) {
        rects.push({ x: 0, y: tileH, width: totalWidth, height: tileH });
        return rects;
    }

    rects.push(
        { x: 0, y: tileH, width: tileW, height: tileH },
        { x: tileW, y: tileH, width: tileW, height: tileH }
    );
    return rects;
}

function drawRoundedImage(ctx, img, x, y, w, h, radius = 15) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
}

function drawCoverImage(ctx, img, rect) {
    const size = getImageSize(img);
    if (!size) return;

    const cover = coverRect(size.width, size.height, rect.x, rect.y, rect.width, rect.height);
    ctx.drawImage(img, cover.x, cover.y, cover.width, cover.height);
}

function drawContainedImage(ctx, img, rect) {
    const size = getImageSize(img);
    if (!size) return;

    const contain = containRect(size.width, size.height, rect.x, rect.y, rect.width, rect.height);
    ctx.drawImage(img, contain.x, contain.y, contain.width, contain.height);
}

function drawApproxBlurredBackground(ctx, imgs, rects, width, height) {
    const blurW = Math.max(1, Math.round(width / BLUR_DOWNSAMPLE_FACTOR));
    const blurH = Math.max(1, Math.round(height / BLUR_DOWNSAMPLE_FACTOR));
    const blurCanvas = createCanvas(blurW, blurH);
    const blurCtx = blurCanvas.getContext('2d');
    const scaleX = blurW / width;
    const scaleY = blurH / height;

    blurCtx.imageSmoothingEnabled = true;
    blurCtx.imageSmoothingQuality = 'high';

    for (let i = 0; i < imgs.length; i++) {
        const rect = rects[i];
        drawCoverImage(blurCtx, imgs[i], {
            x: rect.x * scaleX,
            y: rect.y * scaleY,
            width: rect.width * scaleX,
            height: rect.height * scaleY,
        });
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(blurCanvas, 0, 0, width, height);
    ctx.restore();
}

function buildCombinedGalleryCanvas(imgs, items) {
    const naturalSize = getCombinedNaturalSize(items);
    if (!naturalSize) return null;

    const renderScale = Math.min(1, MAX_COMBINED_RENDER_WIDTH / naturalSize.width);
    const width = Math.max(1, Math.round(naturalSize.width * renderScale));
    const height = Math.max(1, Math.round(naturalSize.height * renderScale));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const rects = getTileRects(imgs.length, width, height);

    ctx.clearRect(0, 0, width, height);
    drawApproxBlurredBackground(ctx, imgs, rects, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < imgs.length; i++) {
        drawContainedImage(ctx, imgs[i], rects[i]);
    }
    ctx.restore();

    return canvas;
}

function computeBaseY(defaultYPosition, calculatedCanvasHeightFromDescLines, heightShim) {
    // If caller provides a Y, trust it (this is now the normal path)
    if (Number.isFinite(defaultYPosition)) return Math.max(0, defaultYPosition);

    // Fallback only for older callers; keep behavior but do not “mystery offset”
    return Math.max(0, (calculatedCanvasHeightFromDescLines || 0) - (heightShim || 0));
}


// Draws an image with a rounded-rect mask (centered horizontally)
function drawRounded(ctx, img, x, y, w, h, radius = 15) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    // subtle border to match your style
    ctx.strokeStyle = '#4d4d4d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

// Single-image layout ---------------------------------------------------------

async function singleImage(ctx, metadata, descHeight, heightShim, mediaMaxHeight, mediaMaxWidth, defaultYPosition) {
    const items = getItems(metadata);
    const m0 = items[0];
    const url = getUrl(m0);
    const nat = getSize(m0) || { width: mediaMaxWidth, height: mediaMaxHeight };
    if (!url) return;

    const img = await loadImage(url);
    const scaled = scaleDownToFitAspectRatio(nat, mediaMaxHeight, mediaMaxWidth);

    const yBase = computeBaseY(defaultYPosition, descHeight, heightShim);
    const x = LEFT_X + mediaMaxWidth / 2 - scaled.width / 2;
    const y = yBase;

    drawRounded(ctx, img, x, y, scaled.width, scaled.height, 15);
}

// Video frame helper (kept for compatibility; rarely used in gallery)
async function singleVideoFrame(ctx, mediaUrl, descHeight, heightShim, mediaMaxHeight, mediaMaxWidth, defaultYPosition) {
    const img = await loadImage(mediaUrl);
    const y = computeBaseY(defaultYPosition, descHeight, heightShim);
    const x = LEFT_X;

    // If landscape, fit width; else crop to target box
    if (img.width > img.height) {
        const ratio = mediaMaxWidth / img.width;
        const h = img.height * ratio;
        ctx.drawImage(img, x, y, mediaMaxWidth, h);
    } else {
        cropSingleImage(ctx, img, mediaMaxWidth, mediaMaxHeight, x, y, { tag: 'gallery/video' });
    }
    return true;
}

function measureGalleryHeight(metadata, mediaMaxHeight, mediaMaxWidth) {
    const items = getItems(metadata).slice(0, 4);
    if (!items.length) return 0;

    const combinedSize = getCombinedNaturalSize(items);
    const scaled = fitWithinBox(
        combinedSize || { width: mediaMaxWidth, height: mediaMaxHeight },
        mediaMaxWidth,
        mediaMaxHeight
    );
    return scaled.height;
}

// Main renderer ---------------------------------------------------------------

async function renderImageGallery(
    ctx,
    metadata,
    calculatedCanvasHeightFromDescLines,
    heightShim,
    mediaMaxHeight,
    mediaMaxWidth,
    defaultYPosition
) {
    console.log('>>>>> renderImageGallery reached!');

    const items = getItems(metadata).slice(0, 4); // support up to 4 images
    if (!items.length) return;

    // Preload URLs & compute baseline scaling from first media
    const urls = items.map(getUrl).filter(Boolean);
    if (!urls.length) return;

    const yBase = computeBaseY(defaultYPosition, calculatedCanvasHeightFromDescLines, heightShim);

    // 1 image
    if (urls.length === 1) {
        await singleImage(ctx, metadata, calculatedCanvasHeightFromDescLines, heightShim, mediaMaxHeight, mediaMaxWidth, defaultYPosition);
        return;
    }

    // Load all images we need in parallel
    const imgs = await Promise.all(urls.map(u => loadImage(u)));
    const combined = buildCombinedGalleryCanvas(imgs, items);
    if (!combined) return;

    const displaySize = fitWithinBox(
        { width: combined.width, height: combined.height },
        mediaMaxWidth,
        mediaMaxHeight
    );
    const x = LEFT_X + (mediaMaxWidth - displaySize.width) / 2;

    drawRoundedImage(ctx, combined, x, yBase, displaySize.width, displaySize.height, 15);
}

module.exports = {
    buildCombinedGalleryCanvas,
    containRect,
    coverRect,
    fitWithinBox,
    getCombinedNaturalSize,
    getTileRects,
    singleImage,
    singleVideoFrame,
    renderImageGallery,
    measureGalleryHeight,
};
