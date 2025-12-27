// features/twitter-post/canvas/safe_load_image.js
const { loadImage } = require('canvas');

async function safeLoadImage(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return undefined;
    try {
        return await loadImage(url);
    } catch {
        return undefined;
    }
}

module.exports = { safeLoadImage };
