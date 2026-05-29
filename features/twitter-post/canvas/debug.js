// features/twitter-post/canvas/debug.js

/** Debug overlay (only when DEBUG_CANVAS_BOXES=1) */
function debugRect(ctx, x, y, w, h, label = '') {
    if (process.env.DEBUG_CANVAS_BOXES !== '1') return;
    ctx.save();
    ctx.strokeStyle = '#33aaff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    if (label) {
        ctx.fillStyle = '#33aaff';
        ctx.font = '10px sans-serif';
        ctx.fillText(label, x + 4, y + 12);
    }
    ctx.restore();
}

module.exports = { debugRect };
