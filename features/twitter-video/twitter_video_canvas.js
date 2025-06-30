// Refactored: features/twitter-video/twitter_video_canvas.js

const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { registerFont, createCanvas, loadImage } = require('canvas');
const { buildPathsAndStuff } = require('../twitter-core/path_builder.js');
const { getWrappedText, drawBasicElements } = require('../twitter-core/canvas_utils.js');

const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK'],
];

function registerFonts(basePath = '/usr/share/fonts') {
    FONT_PATHS.forEach(([relativePath, family]) => {
        registerFont(`${basePath}${relativePath}`, { family });
    });
}

function calculateCanvasHeight(lines, baseY, heightShim, lineHeight = 30, padding = 40) {
    return (lines.length * lineHeight) + baseY + padding + heightShim;
}

function getHeightShim(media) {
    const MAX_WIDTH = 560;
    const defaultShim = 600;
    if (!media?.width || !media?.height) return defaultShim;

    return media.width > media.height
        ? media.height * (MAX_WIDTH / media.width)
        : defaultShim;
}

async function createTwitterVideoCanvas(metadataJson) {
    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: metadataJson.text || "",
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
    };

    registerFonts();
    const globalFont = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';
    const canvasWidth = 600;
    const media = metadata.mediaExtended?.[0]?.size || { width: 0, height: 0 };
    const heightShim = getHeightShim(media);

    const canvas = createCanvas(canvasWidth, 650);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textDrawingMode = 'glyph';

    ctx.font = '18px "Noto Color Emoji"';
    const hasDescription = metadata.description.trim().length > 0;
    const descLines = hasDescription ? getWrappedText(ctx, metadata.description, 420) : [];
    const baseY = 110;
    let canvasHeight = calculateCanvasHeight(descLines, baseY, heightShim);
    if (!hasDescription) canvasHeight -= 40;

    canvas.height = canvasHeight;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const [favicon, pfp] = await Promise.all([
        loadImage('https://abs.twimg.com/favicons/twitter.3.ico'),
        loadImage(metadata.pfpUrl),
    ]);

    if (hasDescription) {
        drawBasicElements(ctx, globalFont, metadata, favicon, pfp, descLines, {
            hasImgs: true,
            hasVids: true,
            yOffset: baseY,
            canvasHeightOffset: canvasHeight,
        });
    } else {
        // drawBasicElements is still needed for layout metadata like pfp & handle
        drawBasicElements(ctx, globalFont, metadata, favicon, pfp, [], {
            hasImgs: true,
            hasVids: true,
            yOffset: baseY,
            canvasHeightOffset: canvasHeight,
        });
    }

    const buffer = canvas.toBuffer('image/png');
    const videoUrl = metadata.mediaUrls[0];
    const { filename, localWorkingPath } = buildPathsAndStuff('/tempdata', videoUrl);
    const outputPath = `${localWorkingPath}/${filename}.png`;

    if (!existsSync(localWorkingPath)) mkdirSync(localWorkingPath, { recursive: true });
    writeFileSync(outputPath, buffer);

    return {
        localFilename: `${filename}.png`,
        canvasHeight,
        canvasWidth: 560,
        heightShim,
    };
}

module.exports = { createTwitterVideoCanvas };
