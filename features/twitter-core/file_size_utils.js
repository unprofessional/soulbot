// features/twitter-core/file_size_utils.js

/**
 * Performs a HEAD request to retrieve the Content-Length of a remote file.
 * @param {string} url - The URL of the file.
 * @returns {Promise<number>} - The file size in bytes.
 */
async function getRemoteFileSize(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });

        if (!response.ok) {
            throw new Error(`Failed to fetch HEAD: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');

        if (!contentLength) {
            throw new Error('No content-length header present');
        }

        return parseInt(contentLength, 10);
    } catch (err) {
        console.error('⚠️ getRemoteFileSize error:', err.message);
        throw err;
    }
}

module.exports = { getRemoteFileSize };
