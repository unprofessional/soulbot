// features/twitter-core/thread_snapshot_utils.js

const { readFile } = require('fs').promises;
const path = require('path');

/**
 * Fetch a tweet by ID.
 * In prod: replace with API or scraping logic.
 * In dev: reads local fixture from `data/tweets/{id}.json`
 * @param {string} tweetID
 * @returns {Promise<Object|null>}
 */
async function fetchTweetById(tweetID) {
    try {
        const filePath = path.join(__dirname, '../../data/tweets', `${tweetID}.json`);
        const raw = await readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`⚠️ fetchTweetById failed for ${tweetID}:`, err.message);
        return null;
    }
}

module.exports = {
    fetchTweetById,
};
