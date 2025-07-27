// features/twitter-core/twitter_handler.js

const { fetchMetadata, fetchQTMetadata } = require('./fetch_metadata.js');
const { renderTwitterPost } = require('./render_twitter_post.js');
const { handleThreadSnapshot } = require('./thread_snapshot_handler.js');
const { stripQueryParams } = require('./utils.js');
const { findMessagesByLink } = require('../../store/services/messages.service.js');

const KNOWN_X_DOMAINS = [
    'twitter.com',
    'x.com',
    'fixupx.com',
    'vxtwitter.com',
    'fxtwitter.com',
];

const twitterUrlRegex = /https?:\/\/([\w.-]+)\/\w+\/status\/(?<statusId>\d+)/gi;
const twitterPattern = /https?:\/\/twitter\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
const xDotComPattern = /https?:\/\/x\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;

/**
 * Handles a Twitter or X URL message.
 * @param {Object} message - Discord message object
 * @param {Object} options - Additional metadata like feature flag state
 */
async function handleTwitterUrl(message, { twitterFeature, guildId }) {
    const content = message.content;

    const matches = [...content.matchAll(twitterUrlRegex)];
    if (matches.length > 0) {
        const { groups: { statusId }, 1: domain } = matches[0];

        const isKnown = KNOWN_X_DOMAINS.includes(domain.toLowerCase());
        const isModern = statusId.length >= 15;

        if (isKnown && (isModern || ['twitter.com', 'x.com'].includes(domain))) {
            console.log('\n✅ Valid Twitter/X status detected:', matches[0][0]);
        }
    }

    const containsTwitter = twitterPattern.test(content);
    const containsX = xDotComPattern.test(content);
    if (!containsTwitter && !containsX) return;

    await message.suppressEmbeds(true);

    const urls = (containsX ? content.match(xDotComPattern) : content.match(twitterPattern)) || [];
    const firstUrl = stripQueryParams(urls[0]);
    let metadata = {};

    const foundMessages = await findMessagesByLink(guildId, message.id, firstUrl);
    const existing = foundMessages?.filter(msg => String(msg.message_id) !== String(message.id))?.[0];

    if (existing) {
        const channelId = existing.meta?.thread_id ? existing.meta.threadId : existing.channel_id;
        const link = `https://discord.com/channels/${guildId}/${channelId}/${existing.message_id}`;
        return message.reply(`Someone already posted this here: ${link}`);
    }

    try {
        metadata = await fetchMetadata(firstUrl, message, containsX);
        if (metadata?.error) return message.reply('Post unavailable! Deleted or protected mode?');

        // 🧵 New: Thread snapshot if this is a reply
        const isMidThread = metadata.replyingToID !== null;
        if (isMidThread) {
            console.log('🧵 Thread Snapshot triggered from mid-thread tweet');
            try {
                const buffer = await handleThreadSnapshot(firstUrl);
                return await message.reply({
                    files: [{ attachment: buffer, name: 'thread.png' }],
                });
                // const content = await handleThreadSnapshot(firstUrl);
                // return message.reply({ content });

            } catch (err) {
                console.error('❌ Failed to render thread snapshot:', err);
                return await message.reply('Failed to render thread snapshot.');
            }
        }

        if (metadata.qrtURL) {
            const qtMeta = await fetchQTMetadata(metadata.qrtURL, message, containsX);
            metadata.qtMetadata = qtMeta;
        }

        if (metadata.error) {
            return message.reply(`Server 500!\n\`\`\`HTML\n${metadata.errorMsg}\n\`\`\``);
        }

        console.log('>>>>> core detect > firstUrl:', firstUrl);
        await renderTwitterPost(metadata, message, firstUrl);
    } catch (err) {
        console.error('[TwitterHandler] metadata fetch failed:', err);
    }
}

module.exports = {
    handleTwitterUrl,
};
