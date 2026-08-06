const { MediaCapacitySemaphore } = require('../../app/media_semaphore.js');

const DEFAULT_TWITTER_VIDEO_CAPACITY = 3;
const MAX_TWITTER_VIDEO_CAPACITY = 3;

function resolveTwitterVideoCapacity(value = process.env.TWIT_MAX_CONCURRENT_RENDERS) {
    if (value === undefined || value === null || value === '') {
        return DEFAULT_TWITTER_VIDEO_CAPACITY;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TWITTER_VIDEO_CAPACITY) {
        console.warn(
            `[MediaCapacity] Invalid TWIT_MAX_CONCURRENT_RENDERS=${value}; ` +
            `using ${DEFAULT_TWITTER_VIDEO_CAPACITY}`
        );
        return DEFAULT_TWITTER_VIDEO_CAPACITY;
    }
    return parsed;
}

const twitterVideoRenderSemaphore = new MediaCapacitySemaphore({
    name: 'twitter-video-render',
    capacity: resolveTwitterVideoCapacity(),
});

module.exports = {
    DEFAULT_TWITTER_VIDEO_CAPACITY,
    MAX_TWITTER_VIDEO_CAPACITY,
    resolveTwitterVideoCapacity,
    twitterVideoRenderSemaphore,
};
