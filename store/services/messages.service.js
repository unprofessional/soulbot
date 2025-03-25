const MessageDAO = require('../dao/message.dao.js');
require('dotenv').config();

const messageDAO = new MessageDAO();

/**
 * Adds a message to the database.
 * @param {Object} message - The message object from Discord.
 */
const addMessage = async (message) => {
    try {
        const structuredMessage = {
            userId: message.author.id,
            guildId: message.guild?.id || null, // Handle direct messages
            channelId: message.channel?.id || null,
            content: message.content || '[Non-text message]',
            attachments: Array.from(message.attachments.values()).map((att) => att.url), // Extract URLs from attachments
        };

        const success = await messageDAO.save(structuredMessage);
        if (!success) {
            console.error('Failed to add message to database');
        } else {
            console.log('Message added successfully:', structuredMessage);
        }
    } catch (err) {
        console.error('Error in addMessage service:', err);
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

const findMessagesByLink = async (guildId, url) => {
    try {
        const messages = await messageDAO.findMessagesByLink(guildId, url);
        console.log('Messages from link retrieved successfully:', messages);
        return messages;
    } catch (err) {
        console.error('Error in findMessagesByLink service:', err);
        throw err;
    }
}

module.exports = { 
    addMessage,
    getMessages,
    findMessagesByLink,
};
