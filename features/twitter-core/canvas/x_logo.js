// Draw locally so branding never depends on a remote favicon or ICO decoder.
function drawXLogo(ctx, x, y, size = 28) {
    const points = [[18.9, 0], [22.6, 0], [14.5, 9.2], [24, 24], [16.6, 24],
        [10.8, 15.1], [3, 24], [0, 24], [9.4, 12.6], [0.8, 0], [8.4, 0],
        [13.6, 8.1], [18.9, 0]];
    const polygon = vertices => {
        ctx.beginPath();
        vertices.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](x + px * size / 24, y + py * size / 24));
        ctx.closePath();
        ctx.fill();
    };
    ctx.save();
    ctx.fillStyle = '#e7e9ea';
    polygon(points);
    ctx.fillStyle = '#000';
    polygon([[5, 2], [7.2, 2], [20, 22], [17.8, 22]]);
    ctx.restore();
}

function drawPostLogo(ctx) {
    // Canvas dimensions are physical pixels; all drawing uses logical pixels.
    const scale = ctx.getTransform?.().a || 1;
    drawXLogo(ctx, ctx.canvas.width / scale - 50, 20, 28);
}

module.exports = { drawXLogo, drawPostLogo };
