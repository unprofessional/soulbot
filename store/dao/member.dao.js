const { pool } = require('../db/pool.js');

class MemberDAO {
    async findAll() {
        const sql = `
            SELECT member_id, prefix
            FROM member
            ORDER BY created_at ASC
        `;
        const result = await pool.query(sql);
        return result.rows;
    }

    async findByMemberId(memberId) {
        const sql = `
            SELECT member_id, prefix
            FROM member
            WHERE member_id = $1
            LIMIT 1
        `;
        const result = await pool.query(sql, [memberId]);
        return result.rows[0] || null;
    }

    async save({ memberId, prefix }) {
        const sql = `
            INSERT INTO member (member_id, prefix)
            VALUES ($1, $2)
            ON CONFLICT (member_id) DO NOTHING
        `;
        const result = await pool.query(sql, [memberId, prefix]);
        return result.rowCount > 0;
    }

    async delete(memberId) {
        const sql = `
            DELETE FROM member
            WHERE member_id = $1
        `;
        const result = await pool.query(sql, [memberId]);
        return result.rowCount > 0;
    }
}

module.exports = MemberDAO;
