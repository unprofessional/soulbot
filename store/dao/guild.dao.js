const { pool } = require('../db/pool.js');

class GuildDAO {
    async findAll() {
        const sql = `
            SELECT guild_id
            FROM guild
            ORDER BY created_at ASC
        `;
        const result = await pool.query(sql);
        return result.rows;
    }

    async exists(guildId) {
        const sql = `
            SELECT 1
            FROM guild
            WHERE guild_id = $1
            LIMIT 1
        `;
        const result = await pool.query(sql, [guildId]);
        return result.rowCount > 0;
    }

    async save(guildId) {
        const sql = `
            INSERT INTO guild (guild_id)
            VALUES ($1)
            ON CONFLICT (guild_id) DO NOTHING
        `;
        const result = await pool.query(sql, [guildId]);
        return result.rowCount > 0;
    }

    async delete(guildId) {
        const sql = `
            DELETE FROM guild
            WHERE guild_id = $1
        `;
        const result = await pool.query(sql, [guildId]);
        return result.rowCount > 0;
    }
}

module.exports = GuildDAO;
