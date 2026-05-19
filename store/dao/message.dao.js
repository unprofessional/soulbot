// store/dao/message.dao.js

const { pool } = require('../db/pool.js');

class MessageDAO {
    /**
     * Find all non-deleted messages with optional filters.
     * @param {Object} options - Filters for the query.
     * @param {string} [options.userId] - Filter by user ID.
     * @param {string} [options.guildId] - Filter by guild ID.
     * @param {string} [options.channelId] - Filter by channel ID.
     * @param {number} [options.limit=50] - Limit the number of results.
     * @returns {Promise<Array>} - List of messages.
     */
    async findAll(options = {}) {
        const {
            userId, guildId, channelId, limit = 50, fields, excludeContent, excludeContentPrefixes, excludeUserId, createdAfter, includeDeleted = false,
        } = options;
        const params = [];
        const conditions = [];

        if (!includeDeleted) {
            conditions.push('deleted_at IS NULL'); // Always filter out soft-deleted messages unless explicitly included
        }

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

        if (createdAfter) {
            conditions.push(`created_at > $${params.length + 1}`);
            params.push(createdAfter);
        }

        if (excludeUserId) {
            conditions.push(`user_id != $${params.length + 1}`);
            params.push(excludeUserId);
        }

        if (excludeContent) {
            conditions.push(`content != $${params.length + 1}`);
            params.push(excludeContent);
        }

        if (Array.isArray(excludeContentPrefixes) && excludeContentPrefixes.length > 0) {
            excludeContentPrefixes.forEach((prefix) => {
                conditions.push(`content NOT LIKE $${params.length + 1}`);
                params.push(`${prefix}%`);
            });
        }

        const selectedFields = Array.isArray(fields) && fields.length > 0
            ? fields.join(', ')
            : '*';

        let sql = `SELECT ${selectedFields} FROM message`;

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        try {
            console.log('>>>>> MessageDAO > findAll > sql:', sql);
            const result = await pool.query(sql, params);
            return result.rows;
        } catch (err) {
            console.error('Error fetching messages:', err);
            throw err;
        }
    }

    async findLatestChannelSummary(channelId, userId, contentPrefix = '**Summary:**') {
        const sql = `
            SELECT user_id, content, created_at
            FROM message
            WHERE deleted_at IS NULL
              AND channel_id = $1
              AND user_id = $2
              AND content LIKE $3
            ORDER BY created_at DESC
            LIMIT 1
        `;

        try {
            console.log('>>>>> MessageDAO > findLatestChannelSummary > sql:', sql);
            const result = await pool.query(sql, [channelId, userId, `${contentPrefix}%`]);
            return result.rows[0] || null;
        } catch (err) {
            console.error('Error fetching latest channel summary:', err);
            throw err;
        }
    }

    async findLatestChannelSummaries(channelId, userId, limit = 3, contentPrefix = '**Summary:**') {
        const sql = `
            SELECT user_id, content, created_at
            FROM message
            WHERE deleted_at IS NULL
              AND channel_id = $1
              AND user_id = $2
              AND content LIKE $3
            ORDER BY created_at DESC
            LIMIT $4
        `;

        try {
            console.log('>>>>> MessageDAO > findLatestChannelSummaries > sql:', sql);
            const result = await pool.query(sql, [channelId, userId, `${contentPrefix}%`, limit]);
            return result.rows;
        } catch (err) {
            console.error('Error fetching latest channel summaries:', err);
            throw err;
        }
    }

    async getAllMessagesToArchive() {
        // SQL query to exclude messages with content '[Non-text message]'
        let sql = `
            SELECT * 
            FROM message
            WHERE content != '[Non-text message]'
        `;
    
        try {
            console.log('>>>>> MessageDAO > getAllMessagesToArchive > sql: ', sql);
            const result = await pool.query(sql);
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
        const { userId, guildId, channelId, messageId, content, attachments, meta } = structuredMessage;

        const sql = `
            INSERT INTO message (user_id, guild_id, channel_id, message_id, content, attachments, meta)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        const params = [
            userId,
            guildId || null,
            channelId || null,
            messageId,
            content,
            attachments,
            meta,
        ];

        try {
            await pool.query(sql, params);
            return true;
        } catch (err) {
            console.error('Error saving message:', err);
            return false;
        }
    }

    /**
     * Find existing non-deleted messages that contain a specific Twitter/X link.
     * @param {string} guildId 
     * @param {string} messageId 
     * @param {string} url 
     * @returns {Promise<Array>}
     */
    async findMessagesByLink(guildId, messageId, url) {
        const urlWithoutParams = url.split('?')[0];

        const twitterUrl = urlWithoutParams.replace(/^https?:\/\/x\.com/, 'https://twitter.com');
        const xUrl = urlWithoutParams.replace(/^https?:\/\/twitter\.com/, 'https://x.com');

        const sql = `
        SELECT * 
        FROM message
        WHERE guild_id = $1
          AND deleted_at IS NULL
          AND (
              content ILIKE $2 OR content ILIKE $3
          )
          AND message_id != $4
        ORDER BY created_at ASC
        LIMIT 1
    `;

        const params = [
            guildId,
            `%${twitterUrl}%`,
            `%${xUrl}%`,
            messageId,
        ];

        try {
            console.log('>>>>> MessageDAO > findMessagesByLink > twitterUrl:', twitterUrl);
            console.log('>>>>> MessageDAO > findMessagesByLink > xUrl:', xUrl);
            const result = await pool.query(sql, params);
            return result.rows;
        } catch (err) {
            console.error('Error finding messages by link:', err);
            throw err;
        }
    }

    async findByMessageId(messageId) {
        const sql = `
            SELECT *
            FROM message
            WHERE message_id = $1
              AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        `;

        try {
            const result = await pool.query(sql, [messageId]);
            return result.rows[0] || null;
        } catch (err) {
            console.error('Error finding message by ID:', err);
            throw err;
        }
    }

    async findLatestUserIdentities(guildId, memberIds = [], messageIds = []) {
        const uniqueMemberIds = [...new Set(memberIds.map(String).filter(Boolean))];
        const uniqueMessageIds = [...new Set(messageIds.map(String).filter(Boolean))];
        if (!guildId || (uniqueMemberIds.length === 0 && uniqueMessageIds.length === 0)) return [];

        const sql = `
            WITH requested(member_id) AS (
                SELECT unnest($2::text[])
            ),
            requested_messages(message_id) AS (
                SELECT unnest($3::text[])
            ),
            identity_events AS (
                SELECT
                    message.user_id AS member_id,
                    NULLIF(message.meta->>'username', '') AS username,
                    NULLIF(COALESCE(message.meta->>'globalName', message.meta->>'global_name'), '') AS global_name,
                    NULLIF(COALESCE(message.meta->>'displayName', message.meta->>'display_name'), '') AS display_name,
                    message.created_at,
                    0 AS source_rank
                FROM message
                JOIN requested ON requested.member_id = message.user_id
                WHERE message.guild_id = $1
                  AND message.meta IS NOT NULL

                UNION ALL

                SELECT
                    message.meta->>'owningUserId' AS member_id,
                    NULLIF(COALESCE(message.meta->>'ownerUsername', message.meta->>'username'), '') AS username,
                    NULLIF(COALESCE(message.meta->>'ownerGlobalName', message.meta->>'globalName', message.meta->>'global_name'), '') AS global_name,
                    NULLIF(COALESCE(message.meta->>'ownerDisplayName', message.meta->>'displayName', message.meta->>'display_name'), '') AS display_name,
                    message.created_at,
                    1 AS source_rank
                FROM message
                JOIN requested ON requested.member_id = message.meta->>'owningUserId'
                WHERE message.guild_id = $1
                  AND message.meta ? 'owningUserId'

                UNION ALL

                SELECT
                    COALESCE(message.meta->>'owningUserId', message.user_id) AS member_id,
                    NULLIF(COALESCE(message.meta->>'ownerUsername', message.meta->>'username'), '') AS username,
                    NULLIF(COALESCE(message.meta->>'ownerGlobalName', message.meta->>'globalName', message.meta->>'global_name'), '') AS global_name,
                    NULLIF(COALESCE(message.meta->>'ownerDisplayName', message.meta->>'displayName', message.meta->>'display_name'), '') AS display_name,
                    message.created_at,
                    0 AS source_rank
                FROM message
                JOIN requested_messages ON requested_messages.message_id = message.message_id
                WHERE message.guild_id = $1
                  AND message.meta IS NOT NULL
            )
            SELECT DISTINCT ON (member_id)
                member_id,
                username,
                global_name,
                display_name,
                created_at
            FROM identity_events
            WHERE username IS NOT NULL
               OR global_name IS NOT NULL
               OR display_name IS NOT NULL
            ORDER BY member_id, source_rank ASC, created_at DESC
        `;

        try {
            const result = await pool.query(sql, [guildId, uniqueMemberIds, uniqueMessageIds]);
            return result.rows;
        } catch (err) {
            console.error('Error fetching latest user identities:', err);
            throw err;
        }
    }

    async findRecentChannelMessagesIncludingDeleted(channelId, limit = 50) {
        const sql = `
            SELECT user_id, content, created_at, deleted_at, meta
            FROM message
            WHERE channel_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `;

        try {
            const result = await pool.query(sql, [channelId, limit]);
            return result.rows;
        } catch (err) {
            console.error('Error fetching recent channel messages including deleted:', err);
            throw err;
        }
    }

    /**
     * Update message content and set updated_at timestamp by message ID.
     * @param {string} messageId - Discord message ID.
     * @param {string} newContent - Updated message text.
     * @returns {Promise<boolean>}
     */
    async updateMessage(messageId, newContent) {
        const sql = `
        UPDATE message
        SET content = $1,
            updated_at = NOW()
        WHERE message_id = $2
    `;

        try {
            await pool.query(sql, [newContent, messageId]);
            return true;
        } catch (err) {
            console.error('Error updating message content:', err);
            return false;
        }
    }

    /**
     * Soft-delete a message by setting deleted_at timestamp.
     * Leaves content, attachments, and meta intact.
     */
    async deleteMessage(messageId) {
        const sql = `
            UPDATE message
            SET deleted_at = NOW()
            WHERE message_id = $1
              AND deleted_at IS NULL
        `;
        try {
            await pool.query(sql, [messageId]);
            return true;
        } catch (err) {
            console.error('Error marking message as deleted:', err);
            return false;
        }
    }
    
}

module.exports = MessageDAO;
