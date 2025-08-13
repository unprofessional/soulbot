// features/twitter-core/webhook_utils.js

const { readFile } = require('node:fs/promises');
const { stripQueryParams } = require('./utils.js');
const { cleanup } = require('../twitter-video/cleanup.js');
const { embedCommunityNote } = require('./canvas_utils.js');

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
 * Sends a message through a webhook with optional files and embeds,
 * impersonating the original user. Deletes the original message and webhook afterward.
 */
const sendWebhookProxyMsg = async (message, content, files = [], communityNoteText, originalLink) => {
    try {
        const parentChannel = message.channel.isThread() ? message.channel.parent : message.channel;
        const webhooks = await parentChannel.fetchWebhooks();

        // Clean up bot webhooks first
        const botWebhooks = webhooks.filter(wh => wh.owner?.id === message.client.user.id);
        for (const webhook of botWebhooks.values()) {
            await webhook.delete().catch(err => console.warn(`Failed to delete webhook: ${err}`));
        }

        const embed = embedCommunityNote(message, communityNoteText);

        // 🔽 New: unified resolver that prefers guild nickname + guild avatar
        const { displayName, avatarURL } = resolveImpersonationIdentity(message);

        const { webhook, threadId } = await webhookBuilder(parentChannel, message, displayName, avatarURL);
        const modifiedContent = trimQueryParamsFromTwitXUrl(message.content);

        await webhook.send({
            content: modifiedContent,
            ...(embed && { embeds: [embed] }),
            ...(threadId && { threadId }),
            username: displayName,
            avatarURL, // also set per-message to ensure correct avatar on send
            files,
        });

        await message.delete();
        await webhook.delete();
    } catch (error) {
        console.error('>>> sendWebhookProxyMsg error:', error);

        const tooLargeErrorStr = 'DiscordAPIError[40005]: Request entity too large';
        const fixupLink = originalLink?.replace('https://x.com', 'https://fixupx.com');

        if (error?.name === 'DiscordAPIError[40005]') {
            await message.reply(`${tooLargeErrorStr}: video file size was likely too large for this server's tier... defaulting to FIXUPX link: ${fixupLink}`);
        }
    }
};

/**
 * Sends a video as a file attachment via webhook proxy, or falls back on failure.
 */
const sendVideoReply = async (message, successFilePath, localWorkingPath, originalLink) => {
    const files = [{
        attachment: await readFile(successFilePath),
        name: 'video.mp4',
    }];

    try {
        await sendWebhookProxyMsg(message, 'Here’s the Twitter canvas:', files, undefined, originalLink);
    } catch (err) {
        console.warn('>>> sendVideoReply > WEBHOOK FAILED!');
        await sendWebhookProxyMsg(message, `File(s) too large to attach! err: ${err}`, undefined, undefined, originalLink);
    } finally {
        await cleanup([], [localWorkingPath]);
    }
};

module.exports = {
    sendWebhookProxyMsg,
    sendVideoReply,
    webhookBuilder, // optional: only export if reused directly elsewhere
};
