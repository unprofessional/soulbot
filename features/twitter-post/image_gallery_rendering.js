// features/twitter-post/image_gallery_rendering.js
/* eslint-disable no-empty */
const { loadImage } = require('canvas');
const { cropSingleImage } = require('./crop_single_image.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');

// features/twitter-post/image_gallery_rendering.js

// ...existing imports...

// Layout constants
const LEFT_X = 20;
const COL_GUTTER_X = 10;
const ROW_GUTTER_Y = 10;

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

function computeBaseY(defaultYPosition, calculatedCanvasHeightFromDescLines, heightShim) {
    // If caller provides a Y, trust it (this is now the normal path)
    if (Number.isFinite(defaultYPosition)) return Math.max(0, defaultYPosition);

    // Fallback only for older callers; keep behavior but do not “mystery offset”
    return Math.max(0, (calculatedCanvasHeightFromDescLines || 0) - (heightShim || 0));
}


// Draws an image with a rounded-rect mask (centered horizontally)
function drawRounded(ctx, img, x, y, w, h, radius = 15) {
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

    const firstSize = getSize(items[0]) || { width: mediaMaxWidth, height: mediaMaxHeight };
    const scaled1 = scaleDownToFitAspectRatio(firstSize, mediaMaxHeight, mediaMaxWidth);

    const n = items.length;

    if (n === 1) {
        return scaled1.height;
    }

    if (n === 2) {
        // side-by-side, height matched to first scaled
        return scaled1.height;
    }

    if (n === 3) {
        // left tall defines total height
        return scaled1.height;
    }

    // n >= 4 => 2x2 grid
    const tileH = Math.round(scaled1.height / 2);
    return tileH * 2 + ROW_GUTTER_Y;
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

    const firstSize = getSize(items[0]) || { width: mediaMaxWidth, height: mediaMaxHeight };
    const scaled1 = scaleDownToFitAspectRatio(firstSize, mediaMaxHeight, mediaMaxWidth);

    const yBase = computeBaseY(defaultYPosition, calculatedCanvasHeightFromDescLines, heightShim);
    const colW = mediaMaxWidth / 2;

    // 1 image
    if (urls.length === 1) {
        await singleImage(ctx, metadata, calculatedCanvasHeightFromDescLines, heightShim, mediaMaxHeight, mediaMaxWidth, defaultYPosition);
        return;
    }

    // Load all images we need in parallel
    const imgs = await Promise.all(urls.map(u => loadImage(u)));

    // 2 images (side-by-side, matched height to first's scaled)
    if (urls.length === 2) {
        const h = scaled1.height;
        cropSingleImage(ctx, imgs[0], colW, h, LEFT_X, yBase, { tag: 'gallery/2-left' });
        cropSingleImage(ctx, imgs[1], colW, h, LEFT_X + colW + COL_GUTTER_X, yBase, { tag: 'gallery/2-right' });
        return;
    }

    // 3 images (left tall, two stacked on right)
    if (urls.length === 3) {
        const leftH = scaled1.height;
        const rightTileH = Math.round((leftH - ROW_GUTTER_Y) / 2);
        const rightX = LEFT_X + colW + COL_GUTTER_X;

        // left column
        cropSingleImage(ctx, imgs[0], colW, leftH, LEFT_X, yBase, { tag: 'gallery/3-left' });
        // right/top
        cropSingleImage(ctx, imgs[1], colW, rightTileH, rightX, yBase, { tag: 'gallery/3-rt' });
        // right/bottom
        cropSingleImage(ctx, imgs[2], colW, rightTileH, rightX, yBase + rightTileH + ROW_GUTTER_Y, { tag: 'gallery/3-rb' });
        return;
    }

    // 4 images (2x2 grid)
    if (urls.length >= 4) {
        const tileH = Math.round(scaled1.height / 2);
        const rightX = LEFT_X + colW + COL_GUTTER_X;
        const row2Y = yBase + tileH + ROW_GUTTER_Y;

        // top row
        cropSingleImage(ctx, imgs[0], colW, tileH, LEFT_X, yBase, { tag: 'gallery/4-tl' });
        cropSingleImage(ctx, imgs[1], colW, tileH, rightX, yBase, { tag: 'gallery/4-tr' });

        // bottom row
        cropSingleImage(ctx, imgs[2], colW, tileH, LEFT_X, row2Y, { tag: 'gallery/4-bl' });
        cropSingleImage(ctx, imgs[3], colW, tileH, rightX, row2Y, { tag: 'gallery/4-br' });
    }
}

module.exports = {
    singleImage,
    singleVideoFrame,
    renderImageGallery,
    measureGalleryHeight,
};
