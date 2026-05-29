// features/twitter-core/layout/geometry.js

const MAIN = {
    fontPx: 24,
    baseY: 110,
    rightPad: 20,
    // descX matches old behavior (videos-only shifts right)
    descXVideosOnly: 80,
    descXDefault: 30,
};

const MAIN_DESKTOP = {
    fontPx: 24,
    baseY: 110,
    rightPad: 40,
    descXNoMedia: 30,
    descXWithMedia: 180,
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
    compactThumbTop: 80,
    compactThumbH: 175,
    compactFooterGap: 12,

    // textX rules
    textXNoMedia: 100,
    textXWithMedia: 230,
};

function getMainLineHeight({ layoutMode = 'compact' } = {}) {
    const fontPx = layoutMode === 'desktop' ? MAIN_DESKTOP.fontPx : MAIN.fontPx;
    const ratio = layoutMode === 'desktop' ? (4 / 3) : 1.25;
    return Math.round(fontPx * ratio);
}

function getMainTextX({ hasImgs, hasVids, layoutMode = 'compact' }) {
    if (layoutMode === 'desktop') {
        return (hasImgs || hasVids) ? MAIN_DESKTOP.descXWithMedia : MAIN_DESKTOP.descXNoMedia;
    }
    return (!hasImgs && hasVids) ? MAIN.descXVideosOnly : MAIN.descXDefault;
}

function getMainBaseY({ layoutMode = 'compact' } = {}) {
    return layoutMode === 'desktop' ? MAIN_DESKTOP.baseY : MAIN.baseY;
}

function getMainWrapWidth({ canvasW, hasImgs, hasVids, layoutMode = 'compact' }) {
    const x = getMainTextX({ hasImgs, hasVids, layoutMode });
    const rightPad = layoutMode === 'desktop' ? MAIN_DESKTOP.rightPad : MAIN.rightPad;
    return Math.max(1, canvasW - x - rightPad);
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

function getQtCompactContentBottom({ textHeight, qtHasMedia }) {
    const textBottom = QT.headerH + textHeight;
    const thumbBottom = qtHasMedia ? (QT.compactThumbTop + QT.compactThumbH) : 0;
    return Math.max(textBottom, thumbBottom);
}

function getQtCompactFooterReserve({ hasFooter }) {
    if (!hasFooter) return QT.compactFooterGap;
    return QT.compactFooterGap + QT.marginBottom + FOOTER.lineH;
}

module.exports = {
    MAIN,
    MAIN_DESKTOP,
    FOOTER,
    QT,
    getMainBaseY,
    getMainLineHeight,
    getMainTextX,
    getMainWrapWidth,
    getQtInnerRect,
    getQtTextX,
    getQtWrapWidth,
    getQtCompactContentBottom,
    getQtCompactFooterReserve,
};
