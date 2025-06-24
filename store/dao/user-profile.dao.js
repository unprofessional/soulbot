// store/dao/user-profile.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class UserDAO {
    async create({ discordId, role = 'player', currentCharacterId = null }) {
        const sql = `
            INSERT INTO user_profile (discord_id, role, current_character_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (discord_id) DO NOTHING
            RETURNING *
        `;
        const params = [discordId, role, currentCharacterId];
        const result = await pool.query(sql, params);
        return result.rows[0] || this.findByDiscordId(discordId); // fallback if already exists
    }

    async findByDiscordId(discordId) {
        const result = await pool.query(
            `SELECT * FROM user_profile WHERE discord_id = $1`,
            [discordId]
        );
        return result.rows[0] || null;
    }

    async setCurrentCharacter(discordId, characterId) {
        const result = await pool.query(
            `UPDATE user_profile
             SET current_character_id = $1
             WHERE discord_id = $2
             RETURNING *`,
            [characterId, discordId]
        );
        return result.rows[0];
    }

    async getCurrentCharacter(discordId) {
        const result = await pool.query(
            `SELECT current_character_id FROM user_profile WHERE discord_id = $1`,
            [discordId]
        );
        return result.rows[0]?.current_character_id || null;
    }
}

module.exports = UserDAO;
