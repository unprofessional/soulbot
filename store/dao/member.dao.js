const { pool } = require('../db/pool.js');

class MemberDAO {
    async findAll() {
        const sql = `
            SELECT member_id, prefix, meta
            FROM member
            ORDER BY created_at ASC
        `;
        const result = await pool.query(sql);
        return result.rows;
    }

    async findByMemberId(memberId) {
        const sql = `
            SELECT member_id, prefix, meta
            FROM member
            WHERE member_id = $1
            LIMIT 1
        `;
        const result = await pool.query(sql, [memberId]);
        return result.rows[0] || null;
    }

    async save({ memberId, prefix = null, meta = {} }) {
        const sql = `
            INSERT INTO member (member_id, prefix, meta)
            VALUES ($1, $2, $3)
            ON CONFLICT (member_id) DO NOTHING
        `;
        const result = await pool.query(sql, [memberId, prefix, meta]);
        return result.rowCount > 0;
    }

    async upsert({ memberId, prefix = null, meta = {} }) {
        const sql = `
            INSERT INTO member (member_id, prefix, meta)
            VALUES ($1, $2, $3)
            ON CONFLICT (member_id)
            DO UPDATE SET
                prefix = CASE
                    WHEN member.prefix IS NULL THEN EXCLUDED.prefix
                    ELSE member.prefix
                END,
                meta = EXCLUDED.meta
            RETURNING member_id, prefix, meta
        `;

        const result = await pool.query(sql, [memberId, prefix, meta]);
        return result.rows[0] || null;
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
