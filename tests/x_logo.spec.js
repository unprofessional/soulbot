const { createCanvas } = require('canvas');
const { drawPostLogo } = require('../features/twitter-core/canvas/x_logo');

test.each([1, 1.5, 2])('keeps the X visible inside a canvas at scale %s without a favicon', scale => {
    const canvas = createCanvas(600 * scale, 100 * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 600, 100);
    drawPostLogo(ctx);
    const pixels = ctx.getImageData(550 * scale, 20 * scale, 28 * scale, 28 * scale).data;
    expect(Array.from(pixels).filter((value, i) => i % 4 === 0 && value > 200).length).toBeGreaterThan(50);
});
