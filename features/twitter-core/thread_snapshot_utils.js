const fetch = require('node-fetch');

/**
 * Fetch tweet data using VXTwitter API.
 * @param {string} tweetID
 * @returns {Promise<Object|null>}
 */
async function fetchTweetById(tweetID) {
    try {
        const res = await fetch(`https://api.vxtwitter.com/Twitter/status/${tweetID}`);
        if (!res.ok) {
            console.warn(`⚠️ VXTwitter fetch failed: ${res.status}`);
            return null;
        }

        const data = await res.json();

        return {
            tweetID: data.tweetID,
            replyingToID: data.replyingToID ?? null,
            text: data.text ?? '',
            user_screen_name: data.user_screen_name ?? 'unknown',
            user_profile_image_url: data.user_profile_image_url ?? '',
            date_epoch: data.date_epoch ?? Date.now() / 1000,
        };
    } catch (err) {
        console.error(`❌ VXTwitter fetchTweetById error:`, err);
        return null;
    }
}

module.exports = {
    fetchTweetById,
};
