const { pool } = require('../db/pool.js');

class OllamaWhitelistDAO {
    async findAll() {
        const sql = `
            SELECT member_id
            FROM ollama_member_whitelist
            ORDER BY created_at ASC
        `;
        const result = await pool.query(sql);
        return result.rows;
    }

    async findByMemberId(memberId) {
        const sql = `
            SELECT member_id
            FROM ollama_member_whitelist
            WHERE member_id = $1
            LIMIT 1
        `;
        const result = await pool.query(sql, [memberId]);
        return result.rows[0] || null;
    }

    async save(memberId) {
        const sql = `
            INSERT INTO ollama_member_whitelist (member_id)
            VALUES ($1)
            ON CONFLICT (member_id) DO NOTHING
        `;
        const result = await pool.query(sql, [memberId]);
        return result.rowCount > 0;
    }

    async delete(memberId) {
        const sql = `
            DELETE FROM ollama_member_whitelist
            WHERE member_id = $1
        `;
        const result = await pool.query(sql, [memberId]);
        return result.rowCount > 0;
    }
}

module.exports = OllamaWhitelistDAO;
