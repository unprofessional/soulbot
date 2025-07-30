// features/twitter-post/twitter_canvas.js

const { registerFont, createCanvas, loadImage } = require('canvas');
const { renderImageGallery } = require('./image_gallery_rendering.js');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');
const {
    getWrappedText,
    drawBasicElements,
    drawDesktopLayout,
    drawQtBasicElements,
    drawQtDesktopLayout,
    drawQtMissingStatus,
    getYPosFromLineHeight
} = require('../twitter-core/canvas_utils.js');
const {
    filterMediaUrls,
    removeTCOLink,
    getExtensionFromMediaUrl
} = require('../twitter-core/utils.js');

const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK']
];

function registerFonts(baseFontUrl = '/usr/share/fonts') {
    FONT_PATHS.forEach(([path, family]) => registerFont(`${baseFontUrl}${path}`, { family }));
}

function getMaxHeight(numImgs) {
    return [0, 800, 600, 530, 530][numImgs] || 600;
}

function calculateQuoteHeight(ctx, qtMetadata) {
    const lineHeight = 30;
    const bottomPadding = 30;
    const hasMedia = qtMetadata.mediaUrls.length > 0;
    const text = qtMetadata.error ? qtMetadata.message : qtMetadata.description;

    ctx.font = '24px "Noto Color Emoji"';
    const wrapWidth = hasMedia ? 320 : 420;
    const qtDescLines = getWrappedText(ctx, text, wrapWidth);
    const descHeight = qtDescLines.length * lineHeight;

    return hasMedia ? Math.max(descHeight, 175 + bottomPadding) : descHeight + bottomPadding;
}

async function safeLoadImage(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return undefined;
    try {
        return await loadImage(url);
    } catch {
        return undefined;
    }
}

async function createTwitterCanvas(metadataJson, isImage) {
    registerFonts();
    const font = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

    const maxWidth = 600;
    const canvas = createCanvas(maxWidth, 650);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textDrawingMode = 'glyph';

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: removeTCOLink(metadataJson.text),
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
        communityNote: removeTCOLink(metadataJson.communityNote)
    };

    const qtMetadata = metadataJson.qtMetadata ? {
        authorNick: metadataJson.qtMetadata?.user_screen_name || '',
        authorUsername: metadataJson.qtMetadata?.user_name || '',
        pfpUrl: metadataJson.qtMetadata?.user_profile_image_url || '',
        date: metadataJson.qtMetadata?.date || '',
        description: metadataJson.qtMetadata?.text || '',
        mediaUrls: metadataJson.qtMetadata?.mediaURLs || [],
        mediaExtended: metadataJson.qtMetadata?.media_extended || [],
        ...(metadataJson.qtMetadata.error && { ...metadataJson.qtMetadata })
    } : null;

    const numImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    const numVids = filterMediaUrls(metadata, ['mp4']).length;
    const hasImgs = numImgs > 0;
    const hasVids = numVids > 0;
    const onlyVids = hasVids && !hasImgs;

    const mediaMaxHeight = getMaxHeight(numImgs);
    let heightShim = 0;

    let mediaObj = { height: 0, width: 0 };
    if (hasImgs) {
        mediaObj = scaleDownToFitAspectRatio(
            metadata.mediaExtended[0].size,
            mediaMaxHeight,
            560
        );
        heightShim = (metadata.mediaExtended.length < 2 && mediaObj.width > mediaObj.height)
            ? mediaObj.height * (560 / mediaObj.width)
            : Math.min(mediaObj.height, mediaMaxHeight);
    }

    const MAX_DESC_CHARS = 1000;
    const MAX_QT_DESC_CHARS = 500;

    if (metadata.description.length > MAX_DESC_CHARS + 50) {
        metadata.description = metadata.description.slice(0, MAX_DESC_CHARS) + '…';
    }

    const maxCharLength = onlyVids ? 120 : 240;
    const descLines = getWrappedText(ctx, metadata.description, maxCharLength);
    const baseY = 110;
    const descHeight = (descLines.length * 30) + baseY + 40 + heightShim;

    let qtHeight = 0;
    if (qtMetadata) {
        if (qtMetadata.description.length > MAX_QT_DESC_CHARS + 50) {
            qtMetadata.description = qtMetadata.description.slice(0, MAX_QT_DESC_CHARS) + '…';
        }
        qtHeight = calculateQuoteHeight(ctx, qtMetadata) + 100 - (qtMetadata.error ? 40 : 0);
    }

    const totalHeight = descHeight + qtHeight;
    canvas.height = totalHeight;
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    const [favicon, pfp] = await Promise.all([
        safeLoadImage('https://abs.twimg.com/favicons/twitter.3.ico'),
        safeLoadImage(metadata.pfpUrl)
    ]);

    const useDesktopLayout = false;

    if (useDesktopLayout) {
        drawDesktopLayout(ctx, font, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight
        });
    } else {
        drawBasicElements(ctx, font, metadata, favicon, pfp, descLines, {
            hasImgs,
            hasVids,
            yOffset: baseY,
            canvasHeightOffset: descHeight
        });
    }

    if (qtMetadata) {
        const qtPfp = await safeLoadImage(qtMetadata.pfpUrl);
        const numQtImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length;
        const numQtVids = filterMediaUrls(qtMetadata, ['mp4']).length;

        if (!qtMetadata.error) {
            const hasQtMedia = numQtImgs > 0 || numQtVids > 0;
            const qtMediaUrl = hasQtMedia
                ? qtMetadata.mediaExtended?.[0]?.thumbnail_url || qtMetadata.mediaUrls?.[0] || null
                : null;
            const qtMediaImg = qtMediaUrl ? await safeLoadImage(qtMediaUrl) : undefined;

            const qtUseDesktopLayout = false;

            if (qtUseDesktopLayout) {
                drawQtDesktopLayout(ctx, font, qtMetadata, qtPfp, qtMediaImg, {
                    canvasHeightOffset: descHeight,
                    qtCanvasHeightOffset: qtHeight
                });
            } else {
                drawQtBasicElements(ctx, font, qtMetadata, qtPfp, qtMediaImg, {
                    canvasHeightOffset: descHeight,
                    qtCanvasHeightOffset: qtHeight,
                    hasImgs,
                    hasVids
                });
            }
        } else {
            drawQtMissingStatus(ctx, font, qtMetadata.message, {
                canvasHeightOffset: descHeight,
                qtCanvasHeightOffset: qtHeight,
                hasImgs: false,
                hasVids: false
            });
        }
    }

    const ext = metadata.mediaExtended?.[0]?.thumbnail_url &&
        getExtensionFromMediaUrl(metadata.mediaExtended[0].thumbnail_url);
    const allowedExts = ['jpg', 'jpeg', 'png'];
    if (allowedExts.includes(ext)) {
        await renderImageGallery(
            ctx,
            metadata,
            descHeight,
            heightShim,
            mediaMaxHeight,
            560,
            getYPosFromLineHeight(descLines, baseY)
        );
    }

    return isImage ? canvas.toBuffer('image/png') : canvas.toBuffer();
}

module.exports = { createTwitterCanvas };
