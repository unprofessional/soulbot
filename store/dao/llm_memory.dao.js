const { pool } = require('../db/pool.js');

class LlmMemoryDAO {
    async findByMemberAndChannel(memberId, channelId) {
        const sql = `
            SELECT member_id, channel_id, summary, updated_at
            FROM llm_memory
            WHERE member_id = $1
              AND channel_id = $2
            LIMIT 1
        `;

        try {
            const result = await pool.query(sql, [memberId, channelId]);
            return result.rows[0] || null;
        } catch (err) {
            console.error('Error fetching llm memory:', err);
            throw err;
        }
    }

    async upsert(memberId, channelId, summary) {
        const sql = `
            INSERT INTO llm_memory (member_id, channel_id, summary)
            VALUES ($1, $2, $3)
            ON CONFLICT (member_id, channel_id)
            DO UPDATE SET
                summary = EXCLUDED.summary,
                updated_at = NOW()
            RETURNING member_id, channel_id, summary, updated_at
        `;

        try {
            const result = await pool.query(sql, [memberId, channelId, summary]);
            return result.rows[0] || null;
        } catch (err) {
            console.error('Error saving llm memory:', err);
            throw err;
        }
    }
}

module.exports = LlmMemoryDAO;
