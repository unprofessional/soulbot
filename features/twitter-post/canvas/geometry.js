// features/twitter-post/canvas/geometry.js

/** Must mirror drawBasicElements' descX logic and canvas margins */
function getMainTextX(hasImgs, hasVids) {
    // In drawBasicElements: const descX = (!hasImgs && hasVids) ? 80 : 30;
    return (!hasImgs && hasVids) ? 80 : 30;
}

function computeMainWrapWidth(canvasWidth, descX, rightPadding = 20) {
    // Right padding should roughly match visual margins used elsewhere
    return Math.max(1, canvasWidth - descX - rightPadding); // e.g., 600 - 30 - 20 = 550
}

module.exports = { getMainTextX, computeMainWrapWidth };
