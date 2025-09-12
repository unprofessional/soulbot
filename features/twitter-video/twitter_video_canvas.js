// features/twitter-video/twitter_video_canvas.js

const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { registerFont, createCanvas, loadImage } = require('canvas');
const { buildPathsAndStuff } = require('../twitter-core/path_builder.js');
const { getWrappedText, drawBasicElements } = require('../twitter-core/canvas_utils.js');
const { collectMedia, formatTwitterDate } = require('../twitter-core/utils.js');

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

async function safeLoadImage(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return undefined;
    try {
        return await loadImage(url);
    } catch {
        return undefined;
    }
}

async function createTwitterVideoCanvas(metadataJson) {
    // Normalize media (works for FX/VX)
    const media = Array.isArray(collectMedia?.(metadataJson)) ? collectMedia(metadataJson)
        : (Array.isArray(metadataJson.media_extended) ? metadataJson.media_extended : []);
    const videos = media.filter(m => (m?.type || '').toLowerCase() === 'video');
    const v0 = videos[0] || null;
    const vSize = v0?.size || { width: v0?.width || 0, height: v0?.height || 0 };

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,

        // full date set for robust formatting
        date: metadataJson.date ?? null,
        date_epoch: metadataJson.date_epoch ?? null,
        created_timestamp: metadataJson.created_timestamp ?? null,
        created_at: metadataJson.created_at ?? null,

        description: (metadataJson.text || '').replace(/\s+https?:\/\/t\.co\/\w+$/i, ''),
        mediaUrls: Array.isArray(metadataJson.mediaURLs) ? metadataJson.mediaURLs : media.map(m => m.url).filter(Boolean),
        mediaExtended: media,
    };

    // Precompute display date (drawer can also compute; this is for parity/logs)
    metadata._displayDate = formatTwitterDate(metadataJson, { label: 'videoCanvas/metaJson→displayDate' });

    registerFonts();
    const globalFont = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

    const canvasWidth = 600;
    const heightShim = getHeightShim(vSize);

    const canvas = createCanvas(canvasWidth, 650);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textDrawingMode = 'glyph';

    // Text wrapping (video layout used 420 previously)
    ctx.font = '18px "Noto Color Emoji"';
    const hasDescription = (metadata.description || '').trim().length > 0;
    const descLines = hasDescription ? getWrappedText(ctx, metadata.description, 420) : [];
    const baseY = 110;

    let canvasHeight = calculateCanvasHeight(descLines, baseY, heightShim);
    if (!hasDescription) canvasHeight -= 40;

    canvas.height = canvasHeight;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const [favicon, pfp] = await Promise.all([
        safeLoadImage('https://abs.twimg.com/favicons/twitter.3.ico'),
        safeLoadImage(metadata.pfpUrl),
    ]);

    // IMPORTANT: pass hasImgs:true to keep descX=30 (no extra 50px indent)
    drawBasicElements(ctx, globalFont, metadata, favicon, pfp, hasDescription ? descLines : [], {
        hasImgs: true,  // <- forces descX to 30px in drawBasicElements
        hasVids: true,
        yOffset: baseY,
        canvasHeightOffset: canvasHeight,
    });

    const buffer = canvas.toBuffer('image/png');

    // Respect explicit output path if provided by caller
    if (metadataJson._canvasOutputPath) {
        const outPath = metadataJson._canvasOutputPath;
        const dir = outPath.replace(/\/[^/]+$/, '');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(outPath, buffer);
        return {
            canvasHeight,
            canvasWidth: 560,
            heightShim,
        };
    }

    // Back-compat fallback path
    const videoUrl = (videos[0]?.url) ||
                   (Array.isArray(metadata.mediaUrls) ? metadata.mediaUrls[0] : null) ||
                   '';
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
