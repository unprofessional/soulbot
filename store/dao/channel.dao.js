const { pool } = require('../db/pool.js');

class ChannelDAO {
    async findAll() {
        const sql = `
            SELECT channel_id
            FROM channel
            ORDER BY created_at ASC
        `;
        const result = await pool.query(sql);
        return result.rows;
    }

    async exists(channelId) {
        const sql = `
            SELECT 1
            FROM channel
            WHERE channel_id = $1
            LIMIT 1
        `;
        const result = await pool.query(sql, [channelId]);
        return result.rowCount > 0;
    }

    async save(channelId) {
        const sql = `
            INSERT INTO channel (channel_id)
            VALUES ($1)
            ON CONFLICT (channel_id) DO NOTHING
        `;
        const result = await pool.query(sql, [channelId]);
        return result.rowCount > 0;
    }

    async delete(channelId) {
        const sql = `
            DELETE FROM channel
            WHERE channel_id = $1
        `;
        const result = await pool.query(sql, [channelId]);
        return result.rowCount > 0;
    }
}

module.exports = ChannelDAO;
