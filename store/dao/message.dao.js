const { Pool } = require('pg');
const {
    pgHost, pgPort, pgUser, pgPass, pgDb,
} = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class MessageDAO {
    /**
     * Find all messages with optional filters.
     * @param {Object} options - Filters for the query.
     * @param {string} [options.userId] - Filter by user ID.
     * @param {string} [options.guildId] - Filter by guild ID.
     * @param {string} [options.channelId] - Filter by channel ID.
     * @param {number} [options.limit] - Limit the number of results.
     * @returns {Promise<Array>} - List of messages.
     */
    async findAll(options = {}) {
        const { userId, guildId, channelId, limit = 50 } = options;
        const params = [];
        let sql = `SELECT * FROM message`;

        // Dynamically build WHERE clause
        const conditions = [];
        if (userId) {
            conditions.push(`user_id = $${params.length + 1}`);
            params.push(userId);
        }
        if (guildId) {
            conditions.push(`guild_id = $${params.length + 1}`);
            params.push(guildId);
        }
        if (channelId) {
            conditions.push(`channel_id = $${params.length + 1}`);
            params.push(channelId);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(' AND ');
        }

        if (limit) {
            sql += ` LIMIT $${params.length + 1}`;
            params.push(limit);
        }

        try {
            const result = await pool.query(sql, params);
            return result.rows;
        } catch (err) {
            console.error('Error fetching messages:', err);
            throw err;
        }
    }

    /**
     * Save a new message to the database.
     * @param {Object} structuredMessage - Message data to save.
     * @param {string} structuredMessage.userId - User ID.
     * @param {string} [structuredMessage.guildId] - Guild ID.
     * @param {string} [structuredMessage.channelId] - Channel ID.
     * @param {string} structuredMessage.content - Message content.
     * @param {Array<string>} structuredMessage.attachments - Array of attachment URLs.
     * @returns {Promise<boolean>} - True if the save was successful.
     */
    async save(structuredMessage) {
        const { userId, guildId, channelId, content, attachments } = structuredMessage;

        const sql = `
            INSERT INTO message (user_id, guild_id, channel_id, content, attachments)
            VALUES ($1, $2, $3, $4, $5)
        `;

        const params = [
            userId,
            guildId || null,
            channelId || null,
            content,
            attachments,
        ];

        try {
            await pool.query(sql, params);
            return true;
        } catch (err) {
            console.error('Error saving message:', err);
            return false;
        }
    }
}

module.exports = MessageDAO;
