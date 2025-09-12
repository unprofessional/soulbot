// features/twitter-core/twitter_handler.js
const { fetchMetadata, fetchQTMetadata } = require('./fetch_metadata.js');
const { renderTwitterPost } = require('./render_twitter_post.js');
const { stripQueryParams } = require('./utils.js');
const { findMessagesByLink } = require('../../store/services/messages.service.js');

const KNOWN_X_DOMAINS = ['twitter.com','x.com','fixupx.com','vxtwitter.com','fxtwitter.com'];
const twitterUrlRegex   = /https?:\/\/([\w.-]+)\/\w+\/status\/(?<statusId>\d+)/gi;
const twitterPattern    = /https?:\/\/twitter\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
const xDotComPattern    = /https?:\/\/x\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;

async function handleTwitterUrl(message, { guildId }) {
    const content = message.content;
    const matches = [...content.matchAll(twitterUrlRegex)];
    if (matches.length > 0) {
        const { groups: { statusId }, 1: domain } = matches[0];
        const isKnown = KNOWN_X_DOMAINS.includes((domain||'').toLowerCase());
        const isModern = statusId?.length >= 15;
        if (isKnown && (isModern || ['twitter.com','x.com'].includes(domain))) {
            console.log('\n✅ Valid Twitter/X status detected:', matches[0][0]);
        }
    }

    const containsTwitter = twitterPattern.test(content);
    const containsX = xDotComPattern.test(content);
    if (!containsTwitter && !containsX) return;

    await message.suppressEmbeds(true);

    const urls = (containsX ? content.match(xDotComPattern) : content.match(twitterPattern)) || [];
    const firstUrl = stripQueryParams(urls[0]);
    const foundMessages = await findMessagesByLink(guildId, message.id, firstUrl);
    const existing = foundMessages?.filter(msg => String(msg.message_id) !== String(message.id))?.[0];
    if (existing) {
        const channelId = existing.meta?.thread_id ? existing.meta.threadId : existing.channel_id;
        const link = `https://discord.com/channels/${guildId}/${channelId}/${existing.message_id}`;
        return message.reply(`Someone already posted this here: ${link}`);
    }

    try {
        const meta = await fetchMetadata(firstUrl, message, containsX, (s)=>console.log(s));

        if (meta?.error) {
            // Only show “deleted/protected” for explicit PRIVATE/NOT_FOUND signals
            if (meta._fx_code === 401 || /PRIVATE/.test(meta.message||'')) {
                return message.reply('Post is private (protected).');
            }
            if (meta._fx_code === 404 || /NOT_FOUND/.test(meta.message||'')) {
                return message.reply('Post not found (deleted?).');
            }
            // Otherwise surface HTTP details for debugging
            return message.reply(
                `Upstream error.\n\`\`\`\n${meta.message || 'Unexpected'}\n${meta.details || ''}\n\`\`\``
            );
        }

        // Pull QT if present
        if (meta.qrtURL) {
            const qtMeta = await fetchQTMetadata(meta.qrtURL, (s)=>console.log(s));
            meta.qtMetadata = qtMeta?.error ? undefined : qtMeta;
        }

        console.log('>>>>> core detect > firstUrl:', firstUrl);
        await renderTwitterPost(meta, message, firstUrl);

    } catch (err) {
        console.error('[TwitterHandler] metadata fetch failed:', err);
        return message.reply('Could not fetch post (network error).');
    }
}

module.exports = { handleTwitterUrl };
