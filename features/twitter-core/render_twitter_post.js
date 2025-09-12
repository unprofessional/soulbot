// features/twitter-core/render_twitter_post.js
const {
    createDirectoryIfNotExists,
    extractFirstVideoUrl,
    isFirstMediaVideo,
} = require('./twitter_post_utils.js');
const { handleVideoPost } = require('./twitter_video_handler.js');
const { handleImagePost } = require('./twitter_image_handler.js');

const { collectMedia, formatTwitterDate } = require('./utils.js');

const processingDir = '/tempdata';
const MAX_CONCURRENT_REQUESTS = 3;

const renderTwitterPost = async (metadataJson, message, originalLink) => {
    console.log('>>>>> renderTwitterPost > originalLink:', originalLink);

    // --- Date debug (raw fields) ---
    console.debug('[date] renderTwitterPost.input', {
        date: metadataJson?.date,
        date_epoch: metadataJson?.date_epoch,
        created_timestamp: metadataJson?.created_timestamp,
        created_at: metadataJson?.created_at,
        tweet_created_at: metadataJson?.tweet?.created_at,
    });

    // Precompute and log formatted
    metadataJson._displayDate = formatTwitterDate(metadataJson, { label: 'renderTwitterPost/meta' });
    console.debug('[date] renderTwitterPost.formatted', { _displayDate: metadataJson._displayDate });

    // Normalize media (robust to FX/VX variants)
    const media = Array.isArray(collectMedia?.(metadataJson)) ? collectMedia(metadataJson) : [];
    const images = media.filter(m => m.type === 'image');
    const videos = media.filter(m => m.type === 'video');

    // Expose normalized sets
    metadataJson._media = media;
    metadataJson._images = images;
    metadataJson._videos = videos;
    metadataJson.hasMedia = media.length > 0;
    metadataJson._firstThumbnail = media[0]?.thumbnail_url || media[0]?.url || null;

    // 🔁 Back-compat shims for downstream code that still reads .media_extended / .mediaURLs
    if (!Array.isArray(metadataJson.media_extended) || metadataJson.media_extended.length === 0) {
        metadataJson.media_extended = media;
    }
    if (!Array.isArray(metadataJson.mediaURLs) || metadataJson.mediaURLs.length === 0) {
        metadataJson.mediaURLs = media.map(m => m.url).filter(Boolean);
    }

    const firstVideo = videos[0]?.url || null;
    const videoUrl =
    firstVideo ||
    (typeof extractFirstVideoUrl === 'function' ? extractFirstVideoUrl(metadataJson) : null);

    const isVideo =
    videos.length > 0 ||
    (typeof isFirstMediaVideo === 'function' && isFirstMediaVideo(metadataJson));

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
