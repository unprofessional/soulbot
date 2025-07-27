/**
 * Fetch a tweet’s metadata via Twitter's public embed endpoint.
 * @param {string} tweetID
 * @returns {Promise<Object|null>}
 */
async function fetchTweetById(tweetID) {
    try {
        const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetID}`);
        if (!res.ok) {
            console.warn(`⚠️ fetch failed for ${tweetID} - status ${res.status}`);
            return null;
        }

        const raw = await res.json();

        return {
            tweetID,
            replyingToID: raw?.in_reply_to_status_id_str ?? null,
            text: raw?.text ?? '',
            user_screen_name: raw?.user?.screen_name ?? 'unknown',
            user_profile_image_url: raw?.user?.profile_image_url_https ?? '',
            date_epoch: raw?.created_at ? new Date(raw.created_at).getTime() / 1000 : Date.now() / 1000,
        };
    } catch (err) {
        console.error(`❌ fetchTweetById error for ${tweetID}:`, err);
        return null;
    }
}

module.exports = {
    fetchTweetById,
};
