// store/services/messages.service.js

const MessageDAO = require('../dao/message.dao.js');
const { soulbotUserId } = require('../../config/env_config.js');
const { consumePendingRenderOwnership } = require('../../features/twitter-core/render_ownership_registry.js');
require('dotenv').config();

const messageDAO = new MessageDAO();
const SOULBOT_EXPECTED_DELETION_PATTERNS = [
    /^Rendering the Twitter\/X video canvas\.\.\.$/i,
    /^Encoding Twitter\/X video\.\.\./i,
    /^Uploading the rendered Twitter\/X video\.\.\.$/i,
];

function isTwitterLinkOnlyContent(content = '') {
    const trimmed = String(content || '').trim();
    if (!trimmed) return false;
    return /^<?https?:\/\/(?:www\.)?(?:x|twitter)\.com\/\S+>?$/i.test(trimmed);
}

function isExpectedSoulbotDeletion(message = {}) {
    if (message.user_id !== soulbotUserId) return false;
    const content = String(message.content || '').trim();
    if (!content) return false;

    return SOULBOT_EXPECTED_DELETION_PATTERNS.some((pattern) => pattern.test(content));
}

function isExpectedDeletedMessage(message = {}) {
    if (!message?.deleted_at) return false;
    if (isTwitterLinkOnlyContent(message.content)) return true;
    if (isExpectedSoulbotDeletion(message)) return true;
    return false;
}

function formatDeletedSummaryMessages(messages = []) {
    return messages.map((message) => ({
        user_id: message.user_id,
        content: message.content,
        deleted_at: message.deleted_at,
    }));
}

/**
 * Adds a message to the database.
 * @param {Object} message - The message object from Discord.
 */
const addMessage = async (message) => {
    try {
        const pendingRenderOwnership = consumePendingRenderOwnership(message.webhookId);
        const ownershipMeta = pendingRenderOwnership
            ? {
                kind: pendingRenderOwnership.kind || 'twitter_render',
                owningUserId: pendingRenderOwnership.owningUserId,
                originalMessageId: pendingRenderOwnership.originalMessageId || null,
                originalChannelId: pendingRenderOwnership.originalChannelId || null,
                originalLink: pendingRenderOwnership.originalLink || null,
                threadId: pendingRenderOwnership.threadId || null,
            }
            : {};

        const structuredMessage = {
            userId: message.author.id,
            guildId: message.guild?.id || null,
            channelId: message.channel?.id || null,
            messageId: message.id,
            content: message.content || '[Non-text message]',
            attachments: Array.from(message.attachments.values()).map((att) => att.url),
            meta: {
                ...(message.channel.isThread?.() && { threadId: message.channel.id }),
                username: message.author.username,
                channelName: message.channel?.name,
                guildName: message.guild?.name,
                ...ownershipMeta,
            },
        };

        const success = await messageDAO.save(structuredMessage);

        // Format timestamp in Eastern Time (EST/EDT), 12-hour, MMM/DD/YYYY
        const timestamp = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(new Date(message.createdTimestamp));

        const serverName = message.guild?.name || 'DM';
        const channelName = message.channel?.name || (message.channel?.isDMBased?.() ? 'DM' : 'Unknown');
        const username = message.author.username;
        const content = structuredMessage.content;

        const logLine = `[${timestamp}] | ${serverName} / ${channelName} | ${username}: ${content}`;

        if (!success) {
            console.error('❌ Failed to add message to database');
        } else {
            console.log('Saved: ', logLine);
        }
    } catch (err) {
        console.error('❗ Error in addMessage service:', err);
    }
};

/**
 * Retrieves messages with optional filters.
 * @param {Object} options - Filters for retrieving messages.
 * @param {string} [options.userId] - Filter by user ID.
 * @param {string} [options.guildId] - Filter by guild ID.
 * @param {string} [options.channelId] - Filter by channel ID.
 * @param {number} [options.limit] - Limit the number of results.
 * @returns {Array} - List of retrieved messages.
 */
const getMessages = async (options = {}) => {
    try {
        const messages = await messageDAO.findAll(options);
        console.log('Messages retrieved successfully:', messages);
        // Reverse the list for the sake of chronological readability for the LLM
        return messages.reverse();
    } catch (err) {
        console.error('Error in getMessages service:', err);
        throw err;
    }
};

const getSummaryMessages = async (options = {}) => {
    try {
        const messages = await messageDAO.findAll({
            ...options,
            fields: ['user_id', 'content'],
            excludeUserId: soulbotUserId,
            excludeContent: '[Non-text message]',
            excludeContentPrefixes: ['**Summary:**'],
        });
        console.log('Summary messages retrieved successfully:', messages);
        return messages.reverse();
    } catch (err) {
        console.error('Error in getSummaryMessages service:', err);
        throw err;
    }
};

const getLlmChannelContext = async (options = {}) => {
    const { limit = 50, ...rest } = options;
    return getSummaryMessages({
        ...rest,
        limit,
    });
};

const getSummaryContext = async (options = {}) => {
    try {
        const { channelId, limit = 100 } = options;
        const latestSummaries = await messageDAO.findLatestChannelSummaries(channelId, soulbotUserId, 3);
        const latestSummary = latestSummaries[0] || null;
        const summaryHistory = latestSummaries.map((summary) => ({
            content: summary.content,
            created_at: summary.created_at,
        }));

        if (!latestSummary) {
            const messages = await getSummaryMessages({ channelId, limit });
            return {
                mode: 'full',
                previousSummary: null,
                messages,
                lastSummaryCreatedAt: null,
                summaryHistory,
            };
        }

        const messages = await messageDAO.findAll({
            channelId,
            limit,
            createdAfter: latestSummary.created_at,
            fields: ['user_id', 'content'],
            excludeUserId: soulbotUserId,
            excludeContent: '[Non-text message]',
            excludeContentPrefixes: ['**Summary:**'],
        });

        const chronologicalMessages = messages.reverse();

        console.log('Summary context retrieved successfully:', {
            mode: 'delta',
            lastSummaryCreatedAt: latestSummary.created_at,
            messagesCount: chronologicalMessages.length,
        });

        return {
            mode: 'delta',
            previousSummary: latestSummary.content,
            messages: chronologicalMessages,
            lastSummaryCreatedAt: latestSummary.created_at,
            summaryHistory,
        };
    } catch (err) {
        console.error('Error in getSummaryContext service:', err);
        throw err;
    }
};

const getDeletedSummaryContext = async (options = {}) => {
    try {
        const { channelId, limit = 50 } = options;
        const recentMessages = await messageDAO.findRecentChannelMessagesIncludingDeleted(channelId, limit);
        const chronologicalMessages = recentMessages.reverse();
        const filteredMessages = chronologicalMessages.filter((message) => !isExpectedDeletedMessage(message));
        const deletedMessages = filteredMessages.filter((message) => message.deleted_at);

        return {
            messages: formatDeletedSummaryMessages(filteredMessages),
            deletedMessages: formatDeletedSummaryMessages(deletedMessages),
            ignoredDeletedCount: chronologicalMessages.filter((message) => isExpectedDeletedMessage(message)).length,
        };
    } catch (err) {
        console.error('Error in getDeletedSummaryContext service:', err);
        throw err;
    }
};

const findMessagesByLink = async (guildId, messageId, url) => {
    try {
        const messages = await messageDAO.findMessagesByLink(guildId, messageId, url);
        console.log('Messages from link retrieved successfully:', messages);
        return messages;
    } catch (err) {
        console.error('Error in findMessagesByLink service:', err);
        throw err;
    }
}

const getMessageById = async (messageId) => {
    try {
        return await messageDAO.findByMessageId(messageId);
    } catch (err) {
        console.error('Error in getMessageById service:', err);
        throw err;
    }
};

const updateMessage = async (messageId, newContent) => {
    try {
        const success = await messageDAO.updateMessage(messageId, newContent);
        if (!success) {
            console.error(`❌ Failed to update message ${messageId}`);
        } else {
            console.log(`✏️ Message ${messageId} updated.`);
        }
        return success;
    } catch (err) {
        console.error('Error in updateMessage service:', err);
        return false;
    }
};

const deleteMessage = async (messageId) => {
    try {
        const success = await messageDAO.deleteMessage(messageId);
        if (!success) {
            console.error(`❌ Failed to delete message ${messageId}`);
        } else {
            console.log(`🗑️ Message ${messageId} marked as deleted.`);
        }
        return success;
    } catch (err) {
        console.error('Error in deleteMessage service:', err);
        return false;
    }
};

module.exports = {
    addMessage,
    getMessages,
    getDeletedSummaryContext,
    getLlmChannelContext,
    getSummaryMessages,
    getSummaryContext,
    findMessagesByLink,
    getMessageById,
    updateMessage,
    deleteMessage,
    isExpectedDeletedMessage,
};
