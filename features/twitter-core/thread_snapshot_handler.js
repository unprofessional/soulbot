// features/twitter-core/thread_snapshot_handler.js

const { fetchTweetById } = require('./thread_snapshot_utils');
const { renderThreadSnapshotCanvas } = require('./thread_snapshot_canvas');
const { extractTweetIdFromUrl } = require('./twitter_post_utils');
const { buildDisplayText, translateMetadataBatchToEnglish } = require('./translation_service.js');
const { runTrackedMediaJob } = require('../../app/media_work_registry.js');

const MAX_THREAD_LENGTH = 6;

/**
 * Handles a Thread Snapshot request.
 * @param {string} tweetUrl - A valid Twitter or X status URL
 * @returns {Promise<Buffer|string>} - PNG buffer of rendered thread snapshot, or plain text fallback
 */
async function handleThreadSnapshot(tweetUrl) {
    return runTrackedMediaJob(
        {
            kind: 'thread-snapshot',
            label: tweetUrl,
        },
        async () => {
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

            while (current.replyingToID && thread.length < MAX_THREAD_LENGTH) {
                const parentTweet = await fetchTweetById(current.replyingToID);
                if (!parentTweet) break;
                thread.unshift(parentTweet);
                current = parentTweet;
            }

            const isTruncated = !!current.replyingToID;

            await translateMetadataBatchToEnglish(thread, (s) => console.log('[ThreadSnapshot][translation]', s));

            // === Build plain text fallback ===
            let fallbackText = isTruncated
                ? `🧵 (${thread.length} posts) — *Earlier posts not shown*\n\n`
                : `🧵 (${thread.length} posts)\n\n`;

            fallbackText += thread.map(post => {
                const user = `@${post.user_screen_name}`;
                const text = buildDisplayText(post).trim().replace(/\s+/g, ' ') || '[no content]';
                return `**${user}**: ${text}`;
            }).join('\n\n');

            // Add safe media properties for the renderer
            for (const post of thread) {
                const media = Array.isArray(post.media_extended) ? post.media_extended : [];
                if (media.length > 0) {
                    const m0 = media[0];
                    post._mediaThumbnailUrl = m0.thumbnail_url || m0.url || null;
                    post._mediaType = m0.type || (m0.format ? 'video' : 'image');
                    post._mediaSize = m0.size || (m0.width && m0.height ? { width: m0.width, height: m0.height } : null);
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
    );
}

module.exports = { handleThreadSnapshot };
