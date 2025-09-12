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

/**
 * Builds the PNG overlay used for video posts.
 * - Uses the same date-fallback logic as images via formatTwitterDate(meta).
 * - Honors metadataJson._canvasOutputPath if provided (so the caller controls the target path).
 * - Normalizes media so it works with FX/VX variants.
 */
async function createTwitterVideoCanvas(metadataJson) {
    // Normalize media (prefer our helper; fall back to legacy arrays)
    const media = Array.isArray(collectMedia?.(metadataJson)) ? collectMedia(metadataJson)
        : (Array.isArray(metadataJson.media_extended) ? metadataJson.media_extended : []);
    const videos = media.filter(m => (m?.type || '').toLowerCase() === 'video');

    // Use the first video’s natural size when available
    const v0 = videos[0] || null;
    const vSize = v0?.size || { width: v0?.width || 0, height: v0?.height || 0 };

    // Prepare metadata for drawBasicElements with full date fields
    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,

        // include all supported date fields so the drawer can format robustly
        date: metadataJson.date ?? null,                    // VX string
        date_epoch: metadataJson.date_epoch ?? null,        // VX seconds
        created_timestamp: metadataJson.created_timestamp ?? null, // FX seconds/ms
        created_at: metadataJson.created_at ?? null,

        description: (metadataJson.text || '').replace(/\s+https?:\/\/t\.co\/\w+$/i, ''),
        mediaUrls: Array.isArray(metadataJson.mediaURLs) ? metadataJson.mediaURLs : media.map(m => m.url).filter(Boolean),
        mediaExtended: media,
    };

    // Precompute display string (kept for parity with image path; drawer may also do its own)
    metadata._displayDate = formatTwitterDate(metadataJson, { label: 'videoCanvas/metaJson→displayDate' });

    registerFonts();
    const globalFont = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

    const canvasWidth = 600;
    const heightShim = getHeightShim(vSize);

    const canvas = createCanvas(canvasWidth, 650);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textDrawingMode = 'glyph';

    // Wrap description (video layout uses a narrower text column)
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

    // Draw header/text/timestamp using the same function as images.
    // hasImgs=false, hasVids=true to keep video text inset behavior, if any.
    drawBasicElements(ctx, globalFont, metadata, favicon, pfp, hasDescription ? descLines : [], {
        hasImgs: false,
        hasVids: true,
        yOffset: baseY,
        canvasHeightOffset: canvasHeight,
    });

    const buffer = canvas.toBuffer('image/png');

    // If the caller provided a specific output path, use it directly.
    if (metadataJson._canvasOutputPath) {
        const outPath = metadataJson._canvasOutputPath;
        const dir = outPath.replace(/\/[^/]+$/, '');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(outPath, buffer);
        return {
            canvasHeight,
            canvasWidth: 560, // overlay region width used by compositor
            heightShim,
        };
    }

    // Fallback: derive a stable path from the first media URL (kept for backward compat)
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
