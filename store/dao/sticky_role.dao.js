const { pool } = require('../db/pool.js');

class StickyRoleDAO {
    async addAssignment(guildId, memberId, roleId) {
        const result = await pool.query(`
            INSERT INTO member_sticky_role (guild_id, member_id, role_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (guild_id, member_id, role_id) DO NOTHING
            RETURNING role_id
        `, [guildId, memberId, roleId]);
        return result.rowCount > 0;
    }

    async removeAssignment(guildId, memberId, roleId) {
        const result = await pool.query(`
            DELETE FROM member_sticky_role
            WHERE guild_id = $1 AND member_id = $2 AND role_id = $3
            RETURNING role_id
        `, [guildId, memberId, roleId]);
        return result.rowCount > 0;
    }

    async getAssignments(guildId, memberId) {
        const result = await pool.query(`
            SELECT role_id
            FROM member_sticky_role
            WHERE guild_id = $1 AND member_id = $2
            ORDER BY assigned_at ASC, role_id ASC
        `, [guildId, memberId]);
        return result.rows.map(row => row.role_id);
    }
}

module.exports = StickyRoleDAO;
