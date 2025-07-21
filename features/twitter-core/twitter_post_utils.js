// features/twitter-core/twitter_post_utils.js

const { mkdir, readdir } = require('fs').promises;
const { getExtensionFromMediaUrl } = require('./utils.js');

async function createDirectoryIfNotExists(dirPath) {
    await mkdir(dirPath, { recursive: true });
}

async function countDirectoriesInDirectory(dirPath) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).length;
}

function filterVideoUrls(mediaUrls = []) {
    return mediaUrls.filter(url => url.split('.').pop().split('?')[0] === 'mp4');
}

function extractFirstVideoUrl(metadataJson) {
    const videoUrls = filterVideoUrls(metadataJson.mediaURLs || []);
    return videoUrls[0] || null;
}

function isFirstMediaVideo(metadataJson) {
    // Just like the original file: don't even check the media type if no mediaURLs
    if (!Array.isArray(metadataJson.mediaURLs) || metadataJson.mediaURLs.length === 0) {
        return false;
    }

    const firstMedia = metadataJson?.media_extended?.[0];

    if (!firstMedia?.url) {
        console.warn('🛑 isFirstMediaVideo: first media URL is missing or invalid:', firstMedia);
        return false;
    }

    const ext = getExtensionFromMediaUrl(firstMedia.url);
    return ext === 'mp4';
}

module.exports = {
    createDirectoryIfNotExists,
    countDirectoriesInDirectory,
    extractFirstVideoUrl,
    isFirstMediaVideo,
};
