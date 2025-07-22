// features/twitter-core/twitter_video_handler.js

const { countDirectoriesInDirectory } = require('./twitter_post_utils.js');
const { buildPathsAndStuff } = require('./path_builder.js');
const { downloadVideo, getVideoFileSize, bakeImageAsFilterIntoVideo } = require('../twitter-video');
const { createTwitterVideoCanvas } = require('../twitter-video/twitter_video_canvas.js');
const { sendVideoReply } = require('./webhook_utils.js');
const { cleanup } = require('../twitter-video/cleanup.js');
// const { getRemoteFileSize } = require('./file_size_utils.js');
const { estimateOutputSizeBytes } = require('./estimate_output_size');

// Discord file upload limits (hardcoded as Discord doesn't expose this via API)
const DISCORD_UPLOAD_LIMITS_MB = {
    0: 8,
    1: 8,
    2: 50,
    3: 100,
};

async function handleVideoPost({ metadataJson, message, originalLink, videoUrl, processingDir, MAX_CONCURRENT_REQUESTS }) {
    const currentDirCount = await countDirectoriesInDirectory(processingDir);
    if (currentDirCount >= MAX_CONCURRENT_REQUESTS) {
        return message.reply({ content: 'Video processing at capacity; try again later.' });
    }

    const { filename, localWorkingPath } = buildPathsAndStuff(processingDir, videoUrl);
    const videoInputPath = `${localWorkingPath}/${filename}.mp4`;
    const canvasInputPath = `${localWorkingPath}/${filename}.png`;
    const videoOutputPath = `${localWorkingPath}/${filename}-output.mp4`;

    const mediaSize = metadataJson?.media_extended?.[0]?.size;
    if (!mediaSize?.height || !mediaSize?.width) {
        throw new Error('Video has no dimensions in metadata!');
    }

    try {
        await downloadVideo(videoUrl, videoInputPath);

        const guild = message.client.guilds.cache.get(message.guildId);
        const boostTier = guild?.premiumTier ?? 0;
        const maxBytes = DISCORD_UPLOAD_LIMITS_MB[boostTier] * 1024 * 1024;

        const estimatedSize = await estimateOutputSizeBytes(videoInputPath, 800);
        const estimatedMB = (estimatedSize / 1024 / 1024).toFixed(2);
        const guildName = message.guild?.name || 'Unknown Guild';

        console.log(`[${guildName}] Estimated: ${estimatedMB}MB / Limit: ${DISCORD_UPLOAD_LIMITS_MB[boostTier]}MB`);

        if (estimatedSize > maxBytes) {
            const fixupLink = originalLink.replace('https://x.com', 'https://fixupx.com');
            return message.reply(`⚠️ Estimated output file too large for this server tier (max ${DISCORD_UPLOAD_LIMITS_MB[boostTier]}MB). Defaulting to FIXUPX link: ${fixupLink}`);
        }

        await logDebugInfo(message, videoInputPath);

        const { canvasHeight, canvasWidth, heightShim } = await createTwitterVideoCanvas(metadataJson);

        const successFilePath = await bakeImageAsFilterIntoVideo(
            videoInputPath, canvasInputPath, videoOutputPath,
            mediaSize.height, mediaSize.width,
            canvasHeight, canvasWidth, heightShim
        );

        await sendVideoReply(message, successFilePath, localWorkingPath, originalLink);
    } catch (err) {
        console.error('>>> ERROR: renderTwitterPost > err:', err);
        await cleanup([], [localWorkingPath]);
    }
}

async function logDebugInfo(message, videoInputPath) {
    const fileSize = await getVideoFileSize(videoInputPath);
    const guild = message.client.guilds.cache.get(message.guildId);
    const boostTier = guild?.premiumTier ?? 0;

    console.log('>>> fileSize:', fileSize);
    console.log('>>> boostTier:', boostTier);
}

module.exports = { handleVideoPost };
