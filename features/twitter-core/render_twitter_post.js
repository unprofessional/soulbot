const { createDirectoryIfNotExists, extractFirstVideoUrl, isFirstMediaVideo } = require('./twitter_post_utils.js');
const { handleVideoPost } = require('./twitter_video_handler.js');
const { handleImagePost } = require('./twitter_image_handler.js');

const processingDir = '/tempdata';
const MAX_CONCURRENT_REQUESTS = 3;

const renderTwitterPost = async (metadataJson, message, originalLink) => {
    console.log('>>>>> renderTwitterPost > originalLink:', originalLink);

    const videoUrl = extractFirstVideoUrl(metadataJson);
    const isVideo = isFirstMediaVideo(metadataJson);

    await createDirectoryIfNotExists(processingDir);

    if (isVideo && videoUrl) {
        return await handleVideoPost({ metadataJson, message, originalLink, videoUrl, processingDir, MAX_CONCURRENT_REQUESTS });
    } else {
        return await handleImagePost({ metadataJson, message, originalLink });
    }
};

module.exports = { renderTwitterPost };
