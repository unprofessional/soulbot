const { pool } = require('../db/pool.js');

class StickyRoleDAO {
    async addConfiguredRole(guildId, roleId) {
        const result = await pool.query(`
            INSERT INTO guild_sticky_role (guild_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (guild_id, role_id) DO NOTHING
            RETURNING role_id
        `, [guildId, roleId]);
        return result.rowCount > 0;
    }

    async removeConfiguredRole(guildId, roleId) {
        const result = await pool.query(`
            WITH removed_config AS (
                DELETE FROM guild_sticky_role
                WHERE guild_id = $1 AND role_id = $2
                RETURNING role_id
            ),
            removed_snapshots AS (
                DELETE FROM member_sticky_role
                WHERE guild_id = $1 AND role_id = $2
            )
            SELECT role_id FROM removed_config
        `, [guildId, roleId]);
        return result.rowCount > 0;
    }

    async getConfiguredRoleIds(guildId) {
        const result = await pool.query(`
            SELECT role_id
            FROM guild_sticky_role
            WHERE guild_id = $1
            ORDER BY created_at ASC, role_id ASC
        `, [guildId]);
        return result.rows.map(row => row.role_id);
    }

    async replaceMemberSnapshot(guildId, memberId, roleIds) {
        const result = await pool.query(`
            WITH cleared AS (
                DELETE FROM member_sticky_role
                WHERE guild_id = $1 AND member_id = $2
            )
            INSERT INTO member_sticky_role (guild_id, member_id, role_id)
            SELECT $1, $2, role_id
            FROM unnest($3::text[]) AS role_id
            ON CONFLICT (guild_id, member_id, role_id)
            DO UPDATE SET captured_at = NOW()
            RETURNING role_id
        `, [guildId, memberId, roleIds]);
        return result.rows.map(row => row.role_id);
    }

    async getMemberSnapshot(guildId, memberId) {
        const result = await pool.query(`
            SELECT role_id
            FROM member_sticky_role
            WHERE guild_id = $1 AND member_id = $2
            ORDER BY role_id ASC
        `, [guildId, memberId]);
        return result.rows.map(row => row.role_id);
    }

    async clearMemberSnapshot(guildId, memberId) {
        await pool.query(`
            DELETE FROM member_sticky_role
            WHERE guild_id = $1 AND member_id = $2
        `, [guildId, memberId]);
    }
}

module.exports = StickyRoleDAO;
