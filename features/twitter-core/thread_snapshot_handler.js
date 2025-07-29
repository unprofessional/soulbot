// features/twitter-core/thread_snapshot_handler.js

const { fetchTweetById } = require('./thread_snapshot_utils');
const { renderThreadSnapshotCanvas } = require('./thread_snapshot_canvas');
const { extractTweetIdFromUrl } = require('./twitter_post_utils');

const MAX_THREAD_LENGTH = 6;

/**
 * Handles a Thread Snapshot request.
 * @param {string} tweetUrl - A valid Twitter or X status URL
 * @returns {Promise<Buffer|string>} - PNG buffer of rendered thread snapshot, or plain text fallback
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

    // === Build plain text fallback ===
    let fallbackText = isTruncated
        ? `🧵 (${thread.length} posts) — *Earlier posts not shown*\n\n`
        : `🧵 (${thread.length} posts)\n\n`;

    fallbackText += thread.map(post => {
        const user = `@${post.user_screen_name}`;
        const text = post.text?.trim().replace(/\s+/g, ' ') || '[no content]';
        return `**${user}**: ${text}`;
    }).join('\n\n');

    // Add media properties
    for (const post of thread) {
        if (post.media_extended?.length > 0) {
            const media = post.media_extended[0];
            post._mediaThumbnailUrl = media.thumbnail_url;
            post._mediaType = media.type;
            post._mediaSize = media.size;
        }
    }

    // === Try rendering canvas ===
    try {
        const buffer = await renderThreadSnapshotCanvas({
            posts: thread,
            centerIndex: thread.length - 1,
            isTruncated,
        });
        return buffer; // PNG Buffer
    } catch (err) {
        console.warn('⚠️ Canvas render failed, falling back to text:', err);
        return fallbackText;
    }
}

module.exports = { handleThreadSnapshot };
