/* eslint-disable no-empty */

// features/twitter-core/twitter_handler.js

const { fetchMetadata, fetchQTMetadata, toFixupx } = require('./fetch_metadata.js');
const { renderTwitterPost } = require('./render_twitter_post.js');
const { stripQueryParams } = require('./utils.js');
const { findMessagesByLink } = require('../../store/services/messages.service.js');

// Domains we consider "known" (for optional logging)
const KNOWN_X_DOMAINS = ['twitter.com', 'x.com', 'fixupx.com', 'vxtwitter.com', 'fxtwitter.com'];

// One global matcher to extract all status URLs from content
const TW_STATUS_GLOBAL = /https?:\/\/([\w.-]+)\/\w+\/status\/(?<statusId>\d+)/gi;

// Non-global testers (avoid stateful lastIndex)
const TWITTER_TEST = /https?:\/\/twitter\.com\/[A-Za-z0-9_]+\/status\/\d+/;
const X_TEST = /https?:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+/;

function replyForError(meta) {
    const code = meta?._fx_code ?? meta?.status ?? meta?.code;
    const msg = (meta?.message || meta?.details || '').toString();

    // 404 variants
    if (code === 404 || /not[-\s]?found|doesn.?t\s+exist/i.test(msg)) return 'That post doesn’t exist (deleted or bad link).';
    // 401 / private / protected
    if (code === 401 || /private|protected/i.test(msg)) return 'Post is private (protected).';
    // 410 Gone
    if (code === 410) return 'That post was removed.';

    // Fallback: short ops-friendly summary (most cases will already be summarized upstream)
    return `Upstream error.\n\`\`\`\n${meta?.message || 'Unexpected'}\n\`\`\``;
}

async function handleTwitterUrl(message, { guildId }) {
    const content = message.content || '';
    const containsTwitter = TWITTER_TEST.test(content);
    const containsX = X_TEST.test(content);
    if (!containsTwitter && !containsX) return;

    // Extract first status URL (works for both twitter.com and x.com)
    const matches = [...content.matchAll(TW_STATUS_GLOBAL)];
    if (matches.length === 0) return;

    const m0 = matches[0];
    const domain = (m0 && m0[1]) ? String(m0[1]).toLowerCase() : '';
    const statusId = m0?.groups?.statusId;

    if (domain && KNOWN_X_DOMAINS.includes(domain) && statusId && statusId.length >= 15) {
        console.log('\n✅ Valid Twitter/X status detected:', m0[0]);
    }

    try {
        await message.suppressEmbeds(true).catch(() => {});
    } catch {}

    const firstUrlRaw = m0[0];
    const firstUrl = stripQueryParams(firstUrlRaw);

    // De-dup per guild/channel by stored link
    const foundMessages = await findMessagesByLink(guildId, message.id, firstUrl);
    const existing = foundMessages?.find(msg => String(msg.message_id) !== String(message.id));

    if (existing) {
        const channelId = existing.meta?.thread_id ? existing.meta.threadId : existing.channel_id;
        const link = `https://discord.com/channels/${guildId}/${channelId}/${existing.message_id}`;

        // NEW: forward the original tweet render into this channel, if we can
        if (channelId) {
            try {
                const originalChannel = await message.client.channels.fetch(channelId);

                if (originalChannel && originalChannel.isTextBased && originalChannel.isTextBased()) {
                    const originalMessage = await originalChannel.messages.fetch(existing.message_id);

                    // discord.js v14.21+ has Message#forward
                    if (originalMessage && typeof originalMessage.forward === 'function') {
                        await originalMessage.forward(message.channel);
                    }
                }
            } catch (err) {
                console.error('[TwitterHandler] failed to forward existing tweet message:', err);
            }
        }

        return message.reply(`Someone already posted this here: ${link}`);
    }

    try {
        const meta = await fetchMetadata(firstUrl, message, containsX, (s) => console.log(s));

        if (meta?.error) {
            const fallback = meta.fallback_link || toFixupx(firstUrl);
            await message.reply(
                `${meta.message}\n${fallback ? `→ ${fallback}` : ''}`.trim()
            );
            return;
        }

        // Extra guard (shouldn’t hit with the new summarizer)
        if (!meta || meta.error) {
            return message.reply(replyForError(meta));
        }

        // Quote-Tweet path (if present)
        if (meta.qrtURL) {
            const qtMeta = await fetchQTMetadata(meta.qrtURL, (s) => console.log(s));
            if (qtMeta?.error) {
                const fallback = qtMeta.fallback_link || toFixupx(meta.qrtURL);
                await message.reply(
                    `${qtMeta.message}\n${fallback ? `→ ${fallback}` : ''}`.trim()
                );
                return;
            }
            meta.qtMetadata = qtMeta;
        }

        console.log('>>>>> core detect > firstUrl:', firstUrl);
        await renderTwitterPost(meta, message, firstUrl);

    } catch (err) {
        console.error('[TwitterHandler] metadata fetch failed:', err);
        return message.reply('Could not fetch post (network error).');
    }
}

module.exports = { handleTwitterUrl };
