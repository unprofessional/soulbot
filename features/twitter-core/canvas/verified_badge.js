function drawVerifiedBadge(ctx, x, y, size = 32, type = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 32, size / 32);
    x = 0;
    y = 0;
    ctx.fillStyle = type === 'organization' ? '#e2b719' : type === 'government' ? '#829aab' : '#1d9bf0';
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12;
        const radius = i % 2 ? 13 : 16;
        ctx[i ? 'lineTo' : 'moveTo'](x + 16 + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 14, y + 5);
    ctx.lineTo(x + 24, y - 6);
    ctx.stroke();
    ctx.restore();
}

// Preserve the author font and fit the name plus badge inside the header column.
function drawAuthorName(ctx, metadata, x, baseline, maxWidth) {
    const verified = metadata.user_verified === true;
    const size = Number(/([\d.]+)px/.exec(ctx.font)?.[1]) || 18;
    const badgeSize = size;
    const gap = 5;
    const reserve = verified ? badgeSize + gap : 0;
    let name = String(metadata.authorUsername || '');
    if (ctx.measureText(name).width > maxWidth - reserve) {
        while (name && ctx.measureText(name + '…').width > maxWidth - reserve) name = name.slice(0, -1);
        name += '…';
    }
    ctx.fillText(name, x, baseline);
    if (verified) drawVerifiedBadge(ctx, x + ctx.measureText(name).width + gap, baseline - size * 0.38, badgeSize, metadata.user_verification_type);
}

module.exports = { drawVerifiedBadge, drawAuthorName };
