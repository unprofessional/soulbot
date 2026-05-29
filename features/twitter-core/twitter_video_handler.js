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
const {
    getDiscordUploadLimitBytes,
    getDiscordUploadLimitMb,
} = require('./discord_upload_limits.js');
const { toFixupx } = require('./fetch_metadata.js');
const {
    acquireTwitterVideoRender,
    buildTwitterVideoRenderKey,
} = require('./twitter_video_render_registry.js');

const USE_ESTIMATION = false; // 🔧 Toggle to `true` to re-enable output size estimation

async function handleVideoPost({
    metadataJson,
    message,
    originalLink,
    videoUrl,
    processingDir,
    processingRunId,
    pathInfo,
    MAX_CONCURRENT_REQUESTS,
    progressMessage,
    mediaJob,
}) {
    const communityNotes = {
        main: metadataJson.communityNote,
        qt: metadataJson.qtMetadata?.communityNote,
    };
    const renderKey = buildTwitterVideoRenderKey({ metadataJson, originalLink, videoUrl });
    const renderFlight = acquireTwitterVideoRender(renderKey);

    const uploadRenderedVideo = async (successFilePath) => {
        await progressMessage?.update?.('Uploading the rendered Twitter/X video...');

        try {
            await sendVideoReply(
                message,
                successFilePath,
                originalLink,
                communityNotes,
            );
            await progressMessage?.dismiss?.();
        } catch (err) {
            await progressMessage?.dismiss?.();

            if (err?.name === 'DiscordAPIError[40005]') {
                const fixupLink = toFixupx(originalLink);
                await message.reply({
                    content: `Discord upload rejected the rendered video because it was too large for this server tier. Defaulting to FIXUPX link: ${fixupLink}`,
                    allowedMentions: { repliedUser: false },
                });
                return;
            }

            throw err;
        }
    };

    const replyFileTooLargeFallback = async (limitMb) => {
        const fixupLink = toFixupx(originalLink);
        await progressMessage?.dismiss?.();
        await message.reply({
            content: `Rendered video exceeded this server tier's upload limit (${limitMb}MB). Defaulting to FIXUPX link: ${fixupLink}`,
            allowedMentions: { repliedUser: false },
        });
    };

    if (!renderFlight.isLeader) {
        try {
            await progressMessage?.update?.('Waiting for the existing Twitter/X video render...');
            const { successFilePath } = await renderFlight.promise;
            await uploadRenderedVideo(successFilePath);
        } catch (err) {
            console.error('>>> ERROR: duplicate Twitter/X video render wait failed:', err);
            if (err?.code === 'OUTPUT_FILE_TOO_LARGE') {
                const guild = message.client.guilds.cache.get(message.guildId);
                const boostTier = guild?.premiumTier ?? 0;
                await replyFileTooLargeFallback(getDiscordUploadLimitMb(boostTier));
                return;
            }
            await progressMessage?.dismiss?.();
            await message.reply({
                content: `Video processing failed for this post. Try again later or use FIXUPX: ${toFixupx(originalLink)}`,
                allowedMentions: { repliedUser: false },
            });
        } finally {
            await renderFlight.release();
        }
        return;
    }

    const currentDirCount = await countDirectoriesInDirectory(processingDir);
    if (currentDirCount >= MAX_CONCURRENT_REQUESTS) {
        await progressMessage?.dismiss?.();
        const capacityReply = await message.reply({
            content: 'Video processing at capacity; try again later.',
            allowedMentions: { repliedUser: false },
        });
        renderFlight.fail(new Error('Video processing at capacity'));
        await renderFlight.release();
        return capacityReply;
    }

    const { filename, localWorkingPath } =
        pathInfo || buildPathsAndStuff(processingDir, videoUrl, processingRunId);
    const videoInputPath = `${localWorkingPath}/${filename}.mp4`;
    const canvasInputPath = `${localWorkingPath}/${filename}.png`;
    const videoOutputPath = `${localWorkingPath}/${filename}-output.mp4`;

    const startTime = Date.now(); // ⏱️ Start timing
    let boostTier = 0;
    let guildName = message.guild?.name || 'Unknown Guild';

    try {
        renderFlight.setCleanup(() => cleanup([], [localWorkingPath]));
        await downloadVideo(videoUrl, videoInputPath);

        const guild = message.client.guilds.cache.get(message.guildId);
        boostTier = guild?.premiumTier ?? 0;
        const maxBytes = getDiscordUploadLimitBytes(boostTier);
        const maxMb = getDiscordUploadLimitMb(boostTier);
        guildName = message.guild?.name || 'Unknown Guild';

        if (USE_ESTIMATION) {
            const estimatedSize = await estimateOutputSizeBytes(videoInputPath, 800);
            const estimatedMB = (estimatedSize / 1024 / 1024).toFixed(2);
            console.log(`[${guildName}] Estimated: ${estimatedMB}MB / Limit: ${maxMb}MB`);

            if (estimatedSize > maxBytes) {
                const fixupLink = originalLink.replace('https://x.com', 'https://fixupx.com');
                await progressMessage?.dismiss?.();
                return message.reply(
                    `⚠️ Estimated output file too large for this server tier (max ${maxMb}MB). Defaulting to FIXUPX link: ${fixupLink}`,
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
            {
                onProgress: async (progress) => {
                    await progressMessage?.updateVideoEncodeProgress?.(progress);
                },
                onSpawn: (proc) => {
                    mediaJob?.attachProcess(proc, { label: 'ffmpeg encode' });
                },
                maxOutputBytes: maxBytes,
            },
        );

        const actualSize = await getVideoFileSize(successFilePath);
        const actualMB = (actualSize / 1024 / 1024).toFixed(2);
        console.log(`[${guildName}] ✅ Output file size: ${actualMB}MB`);

        // Optional: dump output file media info
        inspectVideoFileDetails(successFilePath, 'output');

        renderFlight.complete({ successFilePath });
        await uploadRenderedVideo(successFilePath);
    } catch (err) {
        console.error('>>> ERROR: renderTwitterPost > err:', err);
        renderFlight.fail(err);
        if (err?.code === 'OUTPUT_FILE_TOO_LARGE') {
            await replyFileTooLargeFallback(getDiscordUploadLimitMb(boostTier));
            return;
        }
        await progressMessage?.dismiss?.();
        await message.reply({
            content: `Video processing failed for this post. Try again later or use FIXUPX: ${toFixupx(originalLink)}`,
            allowedMentions: { repliedUser: false },
        });
    } finally {
        await renderFlight.release();
        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`⏱️ Video processing completed in ${totalTime.toFixed(2)}s`);
    }
}

module.exports = { handleVideoPost };
