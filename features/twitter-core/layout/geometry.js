// features/twitter-core/layout/geometry.js

const MAIN = {
    fontPx: 24,
    lineH: 30,
    baseY: 110,
    rightPad: 20,
    // descX matches old behavior (videos-only shifts right)
    descXVideosOnly: 80,
    descXDefault: 30,
};

const FOOTER = {
    fontPx: 18,
    lineH: 24,
};

const QT = {
    x: 20,
    w: 560,
    innerPad: 20,
    headerH: 100,
    lineH: 30,
    bottomPad: 30,
    marginBottom: 8,
    compactMinWithMedia: 285,

    // textX rules
    textXNoMedia: 100,
    textXWithMedia: 230,
};

function getMainTextX({ hasImgs, hasVids }) {
    return (!hasImgs && hasVids) ? MAIN.descXVideosOnly : MAIN.descXDefault;
}

function getMainWrapWidth({ canvasW, hasImgs, hasVids }) {
    const x = getMainTextX({ hasImgs, hasVids });
    return Math.max(1, canvasW - x - MAIN.rightPad);
}

function getQtInnerRect() {
    const innerLeft = QT.x + QT.innerPad;
    const innerRight = QT.x + QT.w - QT.innerPad;
    const innerW = innerRight - innerLeft;
    return { innerLeft, innerRight, innerW };
}

function getQtTextX({ expandQtMedia, qtHasMedia }) {
    const { innerLeft } = getQtInnerRect();
    if (expandQtMedia) return innerLeft;
    return qtHasMedia ? QT.textXWithMedia : QT.textXNoMedia;
}

function getQtWrapWidth({ expandQtMedia, qtHasMedia }) {
    const { innerRight } = getQtInnerRect();
    const textX = getQtTextX({ expandQtMedia, qtHasMedia });
    return Math.max(1, innerRight - textX);
}

module.exports = {
    MAIN,
    FOOTER,
    QT,
    getMainTextX,
    getMainWrapWidth,
    getQtInnerRect,
    getQtTextX,
    getQtWrapWidth,
};
