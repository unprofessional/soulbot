// features/twitter-core/thread_snapshot_canvas.js

const { createCanvas, loadImage } = require('canvas');

const WIDTH = 1080;
const HEIGHT = 1200;

const PADDING_X = 40;
const PADDING_Y = 60;
const BUBBLE_WIDTH = 700;
const AVATAR_SIZE = 48;
const LINE_HEIGHT = 22;
const FONT_SIZE = 14;

/**
 * Render a canvas from thread post data.
 * @param {Object} options
 * @param {Array<Object>} options.posts
 * @param {number} options.centerIndex
 * @param {boolean} options.isTruncated
 * @returns {Promise<Buffer>}
 */
async function renderThreadSnapshotCanvas({ posts, centerIndex, isTruncated }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.font = `${FONT_SIZE}px sans-serif`;
    ctx.fillStyle = '#000000';

    let y = PADDING_Y;

    // Optional "Earlier posts" header
    if (isTruncated) {
        ctx.fillStyle = '#888';
        ctx.fillText(`${centerIndex} earlier posts not shown`, PADDING_X, y);
        y += LINE_HEIGHT * 2;
    }

    for (const post of posts) {
        const { user_screen_name, user_profile_image_url, text, date_epoch } = post;

        // Avatar
        try {
            const avatarImg = await loadImage(user_profile_image_url);
            ctx.save();
            ctx.beginPath();
            ctx.arc(PADDING_X + AVATAR_SIZE / 2, y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, PADDING_X, y, AVATAR_SIZE, AVATAR_SIZE);
            ctx.restore();
        } catch {
            // fallback avatar render
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.arc(PADDING_X + AVATAR_SIZE / 2, y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Username + timeAgo
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`@${user_screen_name}`, PADDING_X + AVATAR_SIZE + 10, y + 16);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText(`· ${formatTimeAgo(date_epoch * 1000)}`, PADDING_X + AVATAR_SIZE + 10 + 120, y + 16);

        y += AVATAR_SIZE + 10;

        // Message bubble
        const bubbleX = PADDING_X + AVATAR_SIZE + 10;
        const bubbleY = y;
        const bubbleHeight = LINE_HEIGHT * 4;

        ctx.fillStyle = '#f2f3f5';
        ctx.fillRect(bubbleX, bubbleY, BUBBLE_WIDTH, bubbleHeight);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#000';
        ctx.fillText(text.slice(0, 160), bubbleX + 12, bubbleY + 22); // naive line wrap for now

        y += bubbleHeight + 30;
    }

    return canvas.toBuffer('image/png');
}

function formatTimeAgo(ms) {
    const deltaSec = Math.floor((Date.now() - ms) / 1000);
    if (deltaSec < 60) return `${deltaSec}s ago`;
    if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
    if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
    return `${Math.floor(deltaSec / 86400)}d ago`;
}

module.exports = {
    renderThreadSnapshotCanvas,
};
