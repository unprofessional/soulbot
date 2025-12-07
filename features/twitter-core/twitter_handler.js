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

    console.log('[TwitterHandler] handleTwitterUrl invoked:', {
        guildId,
        messageId: message.id,
        containsTwitter,
        containsX,
        contentSnippet: content.slice(0, 120),
    });

    if (!containsTwitter && !containsX) {
        console.log('[TwitterHandler] No twitter/x.com link detected, skipping.');
        return;
    }

    // Extract first status URL (works for both twitter.com and x.com)
    const matches = [...content.matchAll(TW_STATUS_GLOBAL)];
    console.log('[TwitterHandler] TW_STATUS_GLOBAL matches count:', matches.length);

    if (matches.length === 0) {
        console.log('[TwitterHandler] No status URL match found, skipping.');
        return;
    }

    const m0 = matches[0];
    const domain = (m0 && m0[1]) ? String(m0[1]).toLowerCase() : '';
    const statusId = m0?.groups?.statusId;

    console.log('[TwitterHandler] First match details:', {
        raw: m0[0],
        domain,
        statusId,
    });

    if (domain && KNOWN_X_DOMAINS.includes(domain) && statusId && statusId.length >= 15) {
        console.log('\n✅ Valid Twitter/X status detected:', m0[0]);
    }

    try {
        console.log('[TwitterHandler] Attempting to suppress embeds for message:', message.id);
        await message.suppressEmbeds(true).catch(() => {});
    } catch (suppressErr) {
        console.warn('[TwitterHandler] suppressEmbeds threw (ignored):', suppressErr);
    }

    const firstUrlRaw = m0[0];
    const firstUrl = stripQueryParams(firstUrlRaw);

    console.log('[TwitterHandler] First URL (raw/stripped):', {
        firstUrlRaw,
        firstUrl,
    });

    // De-dup per guild/channel by stored link
    console.log('[TwitterHandler] Checking for existing messages by link...', {
        guildId,
        currentMessageId: message.id,
        firstUrl,
    });

    const foundMessages = await findMessagesByLink(guildId, message.id, firstUrl).catch(err => {
        console.error('[TwitterHandler] findMessagesByLink failed:', err);
        return [];
    });

    console.log('[TwitterHandler] findMessagesByLink result count:', foundMessages?.length || 0);

    const existing = foundMessages?.find(msg => String(msg.message_id) !== String(message.id));

    if (existing) {
        console.log('[TwitterHandler] Duplicate tweet link detected, existing record:', {
            existingMessageId: existing.message_id,
            existingChannelId: existing.channel_id,
            existingMeta: existing.meta,
        });

        const channelId = existing.meta?.thread_id ? existing.meta.threadId : existing.channel_id;
        const link = `https://discord.com/channels/${guildId}/${channelId}/${existing.message_id}`;

        console.log('[TwitterHandler] Resolved original message location:', {
            guildId,
            channelId,
            link,
        });

        // NEW: forward the original tweet render into this channel, if we can
        if (channelId) {
            try {
                console.log('[TwitterHandler] Fetching original channel to forward from:', channelId);
                const originalChannel = await message.client.channels.fetch(channelId);

                if (!originalChannel) {
                    console.warn('[TwitterHandler] originalChannel fetch returned null/undefined for channelId:', channelId);
                } else {
                    console.log('[TwitterHandler] originalChannel fetched:', {
                        id: originalChannel.id,
                        type: originalChannel.type,
                        isTextBased: typeof originalChannel.isTextBased === 'function'
                            ? originalChannel.isTextBased()
                            : null,
                    });
                }

                if (originalChannel && typeof originalChannel.isTextBased === 'function' && originalChannel.isTextBased()) {
                    console.log('[TwitterHandler] Fetching original message:', existing.message_id);
                    const originalMessage = await originalChannel.messages.fetch(existing.message_id);

                    console.log('[TwitterHandler] originalMessage fetched, checking for .forward():', {
                        originalMessageId: originalMessage?.id,
                        hasForward: typeof originalMessage?.forward === 'function',
                    });

                    // discord.js v14.21+ has Message#forward
                    if (originalMessage && typeof originalMessage.forward === 'function') {
                        console.log('[TwitterHandler] Forwarding originalMessage into current channel:', {
                            fromChannelId: originalChannel.id,
                            toChannelId: message.channel.id,
                        });
                        await originalMessage.forward(message.channel);
                        console.log('[TwitterHandler] Forward completed.');
                    } else {
                        console.warn('[TwitterHandler] originalMessage.forward is not a function; check discord.js version.');
                    }
                } else {
                    console.warn('[TwitterHandler] originalChannel is not text-based; cannot fetch messages.');
                }
            } catch (err) {
                console.error('[TwitterHandler] failed to forward existing tweet message:', err);
            }
        } else {
            console.warn('[TwitterHandler] No valid channelId resolved for existing tweet message; skipping forward.');
        }

        console.log('[TwitterHandler] Replying with duplicate notice link.');
        return message.reply(`Someone already posted this here: ${link}`);
    }

    console.log('[TwitterHandler] No existing message found, proceeding with fresh fetchMetadata.');

    try {
        const meta = await fetchMetadata(firstUrl, message, containsX, (s) => console.log('[TwitterHandler][fetchMetadata]', s));

        console.log('[TwitterHandler] fetchMetadata meta summary:', {
            hasError: !!meta?.error,
            code: meta?._fx_code ?? meta?.status ?? meta?.code,
            hasQRT: !!meta?.qrtURL,
        });

        if (meta?.error) {
            const fallback = meta.fallback_link || toFixupx(firstUrl);
            console.log('[TwitterHandler] meta.error present, replying with fallback if any:', {
                message: meta.message,
                fallback,
            });
            await message.reply(
                `${meta.message}\n${fallback ? `→ ${fallback}` : ''}`.trim()
            );
            return;
        }

        // Extra guard (shouldn’t hit with the new summarizer)
        if (!meta || meta.error) {
            console.warn('[TwitterHandler] meta falsy or error flagged after guard, using replyForError.');
            return message.reply(replyForError(meta));
        }

        // Quote-Tweet path (if present)
        if (meta.qrtURL) {
            console.log('[TwitterHandler] QRT detected, fetching QT metadata:', meta.qrtURL);
            const qtMeta = await fetchQTMetadata(meta.qrtURL, (s) => console.log('[TwitterHandler][fetchQTMetadata]', s));
            console.log('[TwitterHandler] fetchQTMetadata qtMeta summary:', {
                hasError: !!qtMeta?.error,
                code: qtMeta?._fx_code ?? qtMeta?.status ?? qtMeta?.code,
            });

            if (qtMeta?.error) {
                const fallback = qtMeta.fallback_link || toFixupx(meta.qrtURL);
                console.log('[TwitterHandler] qtMeta.error present, replying with fallback if any:', {
                    message: qtMeta.message,
                    fallback,
                });
                await message.reply(
                    `${qtMeta.message}\n${fallback ? `→ ${fallback}` : ''}`.trim()
                );
                return;
            }
            meta.qtMetadata = qtMeta;
        }

        console.log('>>>>> core detect > firstUrl:', firstUrl);
        console.log('[TwitterHandler] Calling renderTwitterPost...');
        await renderTwitterPost(meta, message, firstUrl);
        console.log('[TwitterHandler] renderTwitterPost completed.');

    } catch (err) {
        console.error('[TwitterHandler] metadata fetch failed:', err);
        return message.reply('Could not fetch post (network error).');
    }
}

module.exports = { handleTwitterUrl };
