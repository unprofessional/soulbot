// features/twitter-core/webhook_utils.js

const { readFile } = require('node:fs/promises');
const { stripQueryParams } = require('./utils.js');
const { embedCommunityNote } = require('./canvas_utils.js');

function normalizeCommunityNotes(communityNotes) {
    if (!communityNotes) return {};
    if (typeof communityNotes === 'string') return { main: communityNotes };
    return typeof communityNotes === 'object' ? communityNotes : {};
}

function buildCommunityNoteEmbeds(message, communityNotes) {
    const notes = normalizeCommunityNotes(communityNotes);
    const embeds = [
        embedCommunityNote(message, notes.main, 'Community Note:'),
        embedCommunityNote(message, notes.qt, 'QT Community Note:'),
    ].filter(Boolean);

    return embeds;
}

/** Resolve impersonation identity: server nickname + server avatar if set, else global. */
const resolveImpersonationIdentity = (message) => {
    // Prefer server nickname; fall back to global display name or username
    const displayName =
        message.member?.nickname ||
        message.author.globalName ||
        message.author.username;

    // Prefer server/guild avatar (Server Profile). If the member has a guild-specific
    // avatar set, GuildMember#displayAvatarURL() will return it; otherwise it falls back
    // to the user's universal avatar.
    const guildScopedAvatarURL = message.member?.displayAvatarURL
        ? message.member.displayAvatarURL({ dynamic: true })
        : null;

    const userAvatarURL = message.author.displayAvatarURL({ dynamic: true });

    const avatarURL = guildScopedAvatarURL || userAvatarURL;

    return { displayName, avatarURL };
};

/**
 * Builds a webhook for impersonating a user, optionally scoped to a thread.
 */
const webhookBuilder = async (parentChannel, message, displayName, avatarURL) => {
    const webhook = await parentChannel.createWebhook({
        name: displayName,
        // Using the resolved avatar (guild-scoped if present)
        avatar: avatarURL,
    });

    let threadId;

    if (message.hasThread && message.thread) {
        threadId = message.thread.id;
    } else if (message.channel.isThread()) {
        threadId = message.channel.id;
    }

    return { webhook, threadId };
};

/**
 * Strips query parameters from Twitter/X URLs and wraps in <angle brackets>.
 */
const trimQueryParamsFromTwitXUrl = (content) => {
    const twitterOrXUrlWithQueryParamPattern = /https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+(?:\?.*)?/g;
    const matches = content.match(twitterOrXUrlWithQueryParamPattern);

    if (!matches || matches.length === 0) return content;

    const strippedUrl = stripQueryParams(matches[0]);
    const cleaned = content.replace(twitterOrXUrlWithQueryParamPattern, strippedUrl);
    return cleaned.replace(/(https:\/\/\S+)/, '<$1>');
};


/**
 * If the incoming message was a Discord "reply", fetch minimal context
 * about the referenced/original message so we can simulate reply text.
 */
async function getReplyMeta(message) {
    const refId = message?.reference?.messageId;
    if (!refId) return null;
    try {
        const refMsg = await message.fetchReference();
        const targetId = refMsg.author?.id ?? null;
        const targetIsWebhook = Boolean(refMsg.webhookId);
        const targetDisplay =
      refMsg.member?.nickname ||
      refMsg.author?.globalName ||
      refMsg.author?.username ||
      'Unknown';
        return {
            url: refMsg.url,
            targetId,
            targetIsWebhook,
            targetDisplay,
        };
    } catch (e) {
        console.warn('getReplyMeta() failed to fetch reference:', e);
        return null;
    }
}

/**
 * Build the visible "reply" header + quoted body since webhooks can’t attach
 * real message references.
 */
function buildSimulatedReplyText(message, modifiedContent, replyMeta) {
    if (!replyMeta) return modifiedContent;

    const replierId = message.author?.id;
    const replierMention = replierId ? `<@${replierId}>` : '**Someone**';

    // If the original was a webhook, don’t @mention (no real user to ping)
    const targetLabel = replyMeta.targetIsWebhook
        ? `**${replyMeta.targetDisplay}**`
        : (replyMeta.targetId ? `<@${replyMeta.targetId}>` : `**${replyMeta.targetDisplay}**`);

    return `${replierMention} replied to ${targetLabel}'s message: ${replyMeta.url}\n` +
         `>>> ${modifiedContent}`;
}


/**
 * Sends a message through a webhook with optional files and embeds,
 * impersonating the original user. Deletes the original message and webhook afterward.
 */
const sendWebhookProxyMsg = async (message, content, files = [], communityNotes, originalLink) => {
    const parentChannel = message.channel.isThread() ? message.channel.parent : message.channel;
    const webhooks = await parentChannel.fetchWebhooks();

    // Clean up bot-owned webhooks first
    const botWebhooks = webhooks.filter(wh => wh.owner?.id === message.client.user.id);
    for (const webhook of botWebhooks.values()) {
        await webhook.delete().catch(err => console.warn(`Failed to delete webhook: ${err}`));
    }

    const embeds = buildCommunityNoteEmbeds(message, communityNotes);

    // Prefer guild nickname + guild avatar for impersonation identity
    const { displayName, avatarURL } = resolveImpersonationIdentity(message);

    const { webhook, threadId } = await webhookBuilder(parentChannel, message, displayName, avatarURL);

    try {
        const modifiedContent = trimQueryParamsFromTwitXUrl(message.content || content || '');

        // If this was a reply, simulate it with a header + quote
        const replyMeta = await getReplyMeta(message);
        const finalContent = buildSimulatedReplyText(message, modifiedContent, replyMeta);

        // Limit pings: only the replied-to user (if real). Block @everyone/@here/roles.
        const allowedMentions =
      replyMeta && !replyMeta.targetIsWebhook && replyMeta.targetId
          ? { parse: [], users: [replyMeta.targetId] }
          : { parse: [] };

        await webhook.send({
            content: finalContent,
            ...(embeds.length && { embeds }),
            ...(threadId && { threadId }),
            username: displayName,
            avatarURL, // also set per-message to ensure correct avatar on send
            files,
            allowedMentions,
        });
    } catch (error) {
        console.error('>>> sendWebhookProxyMsg error:', error);
        await webhook.delete().catch(err => console.warn(`Failed to delete webhook after send error: ${err}`));
        error.originalLink = originalLink;
        throw error;
    }

    await message.delete().catch(err => console.warn(`Failed to delete source message: ${err}`));
    await webhook.delete().catch(err => console.warn(`Failed to delete webhook: ${err}`));
};

/**
 * Sends a video as a file attachment via webhook proxy, or falls back on failure.
 * (kept here for convenience since other modules import it from webhook_utils)
 */
const sendVideoReply = async (message, successFilePath, originalLink, communityNotes) => {
    const files = [{
        attachment: await readFile(successFilePath),
        name: 'video.mp4',
    }];

    await sendWebhookProxyMsg(
        message,
        'Here’s the Twitter canvas:',
        files,
        communityNotes,
        originalLink
    );
};

module.exports = {
    buildCommunityNoteEmbeds,
    sendWebhookProxyMsg,
    sendVideoReply,
    webhookBuilder, // optional: only export if reused directly elsewhere
};
