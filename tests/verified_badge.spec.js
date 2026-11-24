const { createCanvas } = require('canvas');
const { drawAuthorName } = require('../features/twitter-core/canvas/verified_badge');
const { normalizeMainMetadata, normalizeQtMetadata } = require('../features/twitter-post/canvas/metadata_normalize');

test.each([true, false, undefined])('propagates explicit verification through main and quote metadata: %s', value => {
    const input = { user_verified: value, text: 'hello', user_name: 'Example' };
    expect(normalizeMainMetadata(input).metadata.user_verified).toBe(value === true);
    expect(normalizeQtMetadata(input).qtMetadata.user_verified).toBe(value === true);
});

test.each([true, false])('fits long names and optional badge into the header: %s', verified => {
    const ctx = createCanvas(600, 100).getContext('2d');
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#fff';
    const fill = jest.spyOn(ctx, 'fillText');
    const translate = jest.spyOn(ctx, 'translate');
    drawAuthorName(ctx, { authorUsername: 'Long author name '.repeat(10), user_verified: verified }, 30, 40, 120);
    const name = fill.mock.calls[0][0];
    expect(ctx.measureText(name).width + (verified ? 23 : 0)).toBeLessThanOrEqual(120);
    expect(translate).toHaveBeenCalledTimes(verified ? 1 : 0);
    expect(ctx.font).toBe('bold 18px sans-serif');
    expect(ctx.fillStyle).toBe('#ffffff');
});
