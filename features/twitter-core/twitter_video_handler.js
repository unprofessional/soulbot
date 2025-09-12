// features/twitter-core/twitter_video_handler.js

const { countDirectoriesInDirectory } = require('./twitter_post_utils.js');
const { buildPathsAndStuff } = require('./path_builder.js');
const {
    downloadVideo,
    getVideoFileSize,
    bakeImageAsFilterIntoVideo,
} = require('../twitter-video');
const { createTwitterVideoCanvas } = require('../twitter-video/twitter_video_canvas.js');
const { sendVideoReply } = require('./webhook_utils.js');
const { cleanup } = require('../twitter-video/cleanup.js');
const { estimateOutputSizeBytes, inspectVideoFileDetails } = require('./estimate_output_size');
const { collectMedia } = require('./utils.js');

const USE_ESTIMATION = false; // 🔧 Toggle to `true` to re-enable output size estimation

const DISCORD_UPLOAD_LIMITS_MB = {
    0: 8,
    1: 8,
    2: 50,
    3: 100,
};

async function handleVideoPost({
    metadataJson,
    message,
    originalLink,
    videoUrl,
    processingDir,
    MAX_CONCURRENT_REQUESTS,
}) {
    const currentDirCount = await countDirectoriesInDirectory(processingDir);
    if (currentDirCount >= MAX_CONCURRENT_REQUESTS) {
        return message.reply({ content: 'Video processing at capacity; try again later.' });
    }

    const { filename, localWorkingPath } = buildPathsAndStuff(processingDir, videoUrl);
    const videoInputPath = `${localWorkingPath}/${filename}.mp4`;
    const canvasInputPath = `${localWorkingPath}/${filename}.png`;
    const videoOutputPath = `${localWorkingPath}/${filename}-output.mp4`;

    const startTime = Date.now(); // ⏱️ Start timing

    try {
        await downloadVideo(videoUrl, videoInputPath);

        const guild = message.client.guilds.cache.get(message.guildId);
        const boostTier = guild?.premiumTier ?? 0;
        const maxBytes = DISCORD_UPLOAD_LIMITS_MB[boostTier] * 1024 * 1024;
        const guildName = message.guild?.name || 'Unknown Guild';

        if (USE_ESTIMATION) {
            const estimatedSize = await estimateOutputSizeBytes(videoInputPath, 800);
            const estimatedMB = (estimatedSize / 1024 / 1024).toFixed(2);
            console.log(`[${guildName}] Estimated: ${estimatedMB}MB / Limit: ${DISCORD_UPLOAD_LIMITS_MB[boostTier]}MB`);

            if (estimatedSize > maxBytes) {
                const fixupLink = originalLink.replace('https://x.com', 'https://fixupx.com');
                await cleanup([], [localWorkingPath]);
                return message.reply(
                    `⚠️ Estimated output file too large for this server tier (max ${DISCORD_UPLOAD_LIMITS_MB[boostTier]}MB). Defaulting to FIXUPX link: ${fixupLink}`,
                );
            }
        } else {
            console.log(`[${guildName}] Skipping size estimation; proceeding to full video processing.`);
        }

        // ---- Robust media dimension sourcing -----------------------------------
        // Prefer normalized _videos → .size, then media_extended video entry, then probe the file.
        const normalized = Array.isArray(metadataJson?._videos) ? metadataJson._videos : [];
        const legacyArr = Array.isArray(metadataJson?.media_extended) ? metadataJson.media_extended : [];

        const v0 =
      normalized[0] ||
      legacyArr.find(m => (m?.type || '').toLowerCase() === 'video') ||
      null;

        let mediaW = v0?.size?.width ?? v0?.width ?? null;
        let mediaH = v0?.size?.height ?? v0?.height ?? null;

        if (!mediaW || !mediaH) {
            // As a final fallback, inspect the downloaded file for natural dimensions.
            const probed = await inspectVideoFileDetails(videoInputPath, 'input');
            if (probed && probed.width && probed.height) {
                mediaW = probed.width;
                mediaH = probed.height;
            }
        }

        if (!mediaW || !mediaH) {
            throw new Error('Unable to determine video dimensions from metadata or probe.');
        }

        // ---- Build the overlay PNG and get layout numbers ----------------------
        // NOTE: createTwitterVideoCanvas should write the PNG to `canvasInputPath`
        // (it knows the destination or accepts it via an internal config).
        const { canvasHeight, canvasWidth, heightShim } =
      await createTwitterVideoCanvas({
          ...metadataJson,
          // Provide a friendly hint for the canvas writer if it supports it
          _canvasOutputPath: canvasInputPath,
      });

        // ---- Compose video with overlay ----------------------------------------
        const successFilePath = await bakeImageAsFilterIntoVideo(
            videoInputPath,
            canvasInputPath,
            videoOutputPath,
            /* media (video) natural size: */ mediaH,
            mediaW,
            /* canvas (overlay) size: */ canvasHeight,
            canvasWidth,
            heightShim,
        );

        const actualSize = await getVideoFileSize(successFilePath);
        const actualMB = (actualSize / 1024 / 1024).toFixed(2);
        console.log(`[${guildName}] ✅ Output file size: ${actualMB}MB`);

        // Optional: dump output file media info
        inspectVideoFileDetails(successFilePath, 'output');

        await sendVideoReply(
            message,
            successFilePath,
            localWorkingPath,
            originalLink,
            metadataJson.communityNote,
        );
    } catch (err) {
        console.error('>>> ERROR: renderTwitterPost > err:', err);
        await cleanup([], [localWorkingPath]);
    } finally {
        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`⏱️ Video processing completed in ${totalTime.toFixed(2)}s`);
    }
}

module.exports = { handleVideoPost };
