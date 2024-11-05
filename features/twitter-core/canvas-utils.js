function drawTextWithSpacing(ctx, text, x, y, letterSpacing = 1) {
    // Set the initial position
    let currentX = x;

    // Draw each character with specified letter spacing
    for (const char of text) {
        ctx.fillText(char, currentX, y);
        // Move the x position by the character width plus the letterSpacing
        currentX += ctx.measureText(char).width + letterSpacing;
    }
}

module.exports = {
    drawTextWithSpacing
};
