// features/twitter-core/render_twitter_post.js

const {
    createDirectoryIfNotExists,
    // (legacy helpers kept; we won't rely on them for correctness)
    extractFirstVideoUrl,
    isFirstMediaVideo,
} = require('./twitter_post_utils.js');
const { handleVideoPost } = require('./twitter_video_handler.js');
const { handleImagePost } = require('./twitter_image_handler.js');

// NEW: robust media collector (preferred)
const { collectMedia } = require('./utils.js');

const processingDir = '/tempdata';
const MAX_CONCURRENT_REQUESTS = 3;

const renderTwitterPost = async (metadataJson, message, originalLink) => {
    console.log('>>>>> renderTwitterPost > originalLink:', originalLink);

    // Normalize media once (works for both FX and VX payloads)
    const media = Array.isArray(collectMedia?.(metadataJson)) ? collectMedia(metadataJson) : [];
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');

    // Preserve legacy flags/fields for downstream code paths
    metadataJson._media = media;
    metadataJson._images = images;
    metadataJson._videos = videos;
    metadataJson.hasMedia = media.length > 0;
    metadataJson._firstThumbnail = media[0]?.thumbnail_url || media[0]?.url || null;

    // Prefer normalized video URL; fall back to legacy helper if needed
    const firstVideo = videos[0]?.url || null;
    const videoUrl = firstVideo || extractFirstVideoUrl?.(metadataJson) || null;
    const isVideo = videos.length > 0 || (typeof isFirstMediaVideo === 'function' && isFirstMediaVideo(metadataJson));

    await createDirectoryIfNotExists(processingDir);

    if (isVideo && videoUrl) {
        return await handleVideoPost({
            metadataJson,
            message,
            originalLink,
            videoUrl,
            processingDir,
            MAX_CONCURRENT_REQUESTS,
        });
    } else {
        return await handleImagePost({ metadataJson, message, originalLink });
    }
};

module.exports = { renderTwitterPost };
