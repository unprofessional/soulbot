const { existsSync, statSync } = require('node:fs');
const { buildPathsAndStuff } = require('./path_builder.js');
const {
    downloadVideo,
    getVideoFileSize,
    bakeImageAsFilterIntoGif,
} = require('../twitter-video');
const { createTwitterVideoCanvas } = require('../twitter-video/twitter_video_canvas.js');
const { sendGifReply } = require('./webhook_utils.js');
const { cleanup } = require('../twitter-video/cleanup.js');
const { inspectVideoFileDetails } = require('./estimate_output_size.js');
const { getDiscordUploadLimitBytes, getDiscordUploadLimitMb } = require('./discord_upload_limits.js');
const { toFixupx } = require('./fetch_metadata.js');
const {
    acquireTwitterVideoRender,
    buildTwitterVideoRenderKey,
} = require('./twitter_video_render_registry.js');
const { twitterVideoRenderSemaphore } = require('./twitter_video_capacity.js');

async function handleGifPost({
    metadataJson,
    message,
    originalLink,
    gifUrl,
    processingDir,
    processingRunId,
    pathInfo,
    progressMessage,
    mediaJob,
    renderSemaphore = twitterVideoRenderSemaphore,
}) {
    const communityNotes = {
        main: metadataJson.communityNote,
        qt: metadataJson.qtMetadata?.communityNote,
    };
    const renderKey = `gif:${buildTwitterVideoRenderKey({ metadataJson, originalLink, videoUrl: gifUrl })}`;
    const renderFlight = acquireTwitterVideoRender(renderKey);

    const upload = async successFilePath => {
        await progressMessage?.update?.('Uploading the rendered Twitter/X GIF...');
        await sendGifReply(message, successFilePath, originalLink, communityNotes);
        await progressMessage?.dismiss?.();
    };

    const replyTooLarge = async limitMb => {
        await progressMessage?.dismiss?.();
        await message.reply({
            content: `Rendered GIF exceeded this server tier's upload limit (${limitMb}MB). Defaulting to FIXUPX link: ${toFixupx(originalLink)}`,
            allowedMentions: { repliedUser: false },
        });
    };

    if (!renderFlight.isLeader) {
        try {
            await progressMessage?.update?.('Waiting for the existing Twitter/X GIF render...');
            const { successFilePath } = await renderFlight.promise;
            await upload(successFilePath);
        } catch (error) {
            if (error?.code === 'OUTPUT_FILE_TOO_LARGE') {
                const tier = message.client.guilds.cache.get(message.guildId)?.premiumTier ?? 0;
                await replyTooLarge(getDiscordUploadLimitMb(tier));
            } else {
                await progressMessage?.dismiss?.();
                await message.reply({
                    content: `GIF processing failed for this post. Try again later or use FIXUPX: ${toFixupx(originalLink)}`,
                    allowedMentions: { repliedUser: false },
                });
            }
        } finally {
            await renderFlight.release();
        }
        return;
    }

    const permit = renderSemaphore.tryAcquire({ jobId: mediaJob?.id, label: renderKey });
    if (!permit) {
        await progressMessage?.dismiss?.();
        await message.reply({
            content: 'GIF processing at capacity; try again later.',
            allowedMentions: { repliedUser: false },
        });
        renderFlight.fail(new Error('GIF processing at capacity'));
        await renderFlight.release();
        return;
    }

    let workingPath;
    let outputPath;
    let boostTier = 0;
    try {
        const paths = pathInfo || buildPathsAndStuff(processingDir, gifUrl, processingRunId);
        workingPath = paths.localWorkingPath;
        const inputPath = `${workingPath}/${paths.filename}.mp4`;
        const canvasPath = `${workingPath}/${paths.filename}.png`;
        outputPath = `${workingPath}/${paths.filename}-output.gif`;
        renderFlight.setCleanup(() => cleanup([], [workingPath]));

        await downloadVideo(gifUrl, inputPath, { signal: mediaJob?.signal });
        boostTier = message.client.guilds.cache.get(message.guildId)?.premiumTier ?? 0;
        const maxBytes = getDiscordUploadLimitBytes(boostTier);
        const gif = metadataJson?._gifs?.[0] || metadataJson?.media_extended?.find(
            media => String(media?.type).toLowerCase() === 'gif'
        );
        let mediaWidth = gif?.size?.width ?? gif?.width;
        let mediaHeight = gif?.size?.height ?? gif?.height;
        if (!mediaWidth || !mediaHeight) {
            const details = await inspectVideoFileDetails(inputPath, 'gif-input');
            mediaWidth = details?.width;
            mediaHeight = details?.height;
        }
        if (!mediaWidth || !mediaHeight) throw new Error('Unable to determine GIF dimensions.');

        const { canvasHeight, canvasWidth, heightShim } = await createTwitterVideoCanvas({
            ...metadataJson,
            _canvasOutputPath: canvasPath,
        });
        const successFilePath = await bakeImageAsFilterIntoGif(
            inputPath,
            canvasPath,
            outputPath,
            mediaHeight,
            mediaWidth,
            canvasHeight,
            canvasWidth,
            heightShim,
            {
                maxOutputBytes: maxBytes,
                onProgress: progress => progressMessage?.updateVideoEncodeProgress?.(progress),
                onSpawn: process => mediaJob?.attachProcess?.(process, { label: 'ffmpeg GIF encode' }),
            },
        );
        await getVideoFileSize(successFilePath);
        renderFlight.complete({ successFilePath });
        await upload(successFilePath);
    } catch (error) {
        console.error('>>> ERROR: Twitter/X GIF render failed:', error);
        renderFlight.fail(error);
        if (error?.code === 'OUTPUT_FILE_TOO_LARGE') {
            await replyTooLarge(getDiscordUploadLimitMb(boostTier));
        } else {
            await progressMessage?.dismiss?.();
            await message.reply({
                content: `GIF processing failed for this post. Try again later or use FIXUPX: ${toFixupx(originalLink)}`,
                allowedMentions: { repliedUser: false },
            });
        }
    } finally {
        try {
            await renderFlight.release();
        } finally {
            permit.release();
            if (outputPath && existsSync(outputPath)) {
                console.log(`[GIF] Output size: ${(statSync(outputPath).size / 1024 / 1024).toFixed(2)}MB`);
            }
        }
    }
}

module.exports = { handleGifPost };
