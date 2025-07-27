const { fetchTweetById } = require('./thread_snapshot_utils');
// const { renderThreadSnapshotCanvas } = require('./thread_snapshot_canvas');
const { extractTweetIdFromUrl } = require('./twitter_post_utils');

const MAX_THREAD_LENGTH = 6;

/**
 * Handles a Thread Snapshot request.
 * @param {string} tweetUrl - A valid Twitter or X status URL
 * @returns {Promise<string>} - Formatted plain text content for proof of concept
 */
async function handleThreadSnapshot(tweetUrl) {
    const tweetID = extractTweetIdFromUrl(tweetUrl);
    if (!tweetID) {
        throw new Error('❌ Invalid tweet URL');
    }

    const startingTweet = await fetchTweetById(tweetID);
    if (!startingTweet) {
        throw new Error('❌ Failed to fetch tweet');
    }

    const thread = [startingTweet];
    let current = startingTweet;

    while (
        current.replyingToID &&
    thread.length < MAX_THREAD_LENGTH
    ) {
        const parentTweet = await fetchTweetById(current.replyingToID);
        if (!parentTweet) break;
        thread.unshift(parentTweet);
        current = parentTweet;
    }

    const isTruncated = !!current.replyingToID;

    // === Plain Text Version ===
    let out = isTruncated
        ? `🧵 (${thread.length} posts) — *Earlier posts not shown*\n\n`
        : `🧵 (${thread.length} posts)\n\n`;

    out += thread.map(post => {
        const user = `@${post.user_screen_name}`;
        const text = post.text?.trim().replace(/\s+/g, ' ');
        return `**${user}**: ${text}`;
    }).join('\n\n');

    return out;

    // === Canvas Rendering (Disabled) ===
    // return await renderThreadSnapshotCanvas({
    //   posts: thread,
    //   centerIndex: thread.length - 1,
    //   isTruncated,
    // });
}

module.exports = { handleThreadSnapshot };
