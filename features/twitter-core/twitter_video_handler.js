const { countDirectoriesInDirectory } = require('./twitter_post_utils.js');
const { buildPathsAndStuff } = require('./path_builder.js');
const { downloadVideo, getVideoFileSize, bakeImageAsFilterIntoVideo } = require('../twitter-video');
const { createTwitterVideoCanvas } = require('../twitter-video/twitter_video_canvas.js');
const { sendVideoReply } = require('./webhook_utils.js');
const { cleanup } = require('../twitter-video/cleanup.js');

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

        await logDebugInfo(message, videoInputPath);

        const { canvasHeight, canvasWidth, heightShim } = await createTwitterVideoCanvas(metadataJson);

        const successFilePath = await bakeImageAsFilterIntoVideo(
            videoInputPath, canvasInputPath, videoOutputPath,
            mediaSize.height, mediaSize.width,
            canvasHeight, canvasWidth, heightShim,
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
    const boostTier = guild?.premiumTier;

    console.log('>>> fileSize:', fileSize);
    console.log('>>> boostTier:', boostTier);
}

module.exports = { handleVideoPost };
