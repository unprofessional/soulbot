// store/dao/player.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class PlayerDAO {
    async create({
        discordId,
        role = 'player',
        currentCharacterId = null,
        currentGameId = null,
    }) {
        const sql = `
            INSERT INTO player (discord_id, role, current_character_id, current_game_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (discord_id) DO NOTHING
            RETURNING *
        `;
        const params = [discordId.trim(), role, currentCharacterId, currentGameId];
        const result = await pool.query(sql, params);

        // If player already exists, return existing record
        return result.rows[0] || await this.findByDiscordId(discordId);
    }

    async findByDiscordId(discordId) {
        const result = await pool.query(
            `SELECT * FROM player WHERE discord_id = $1`,
            [discordId.trim()]
        );
        return result.rows[0] || null;
    }

    async setCurrentCharacter(discordId, characterId) {
        const result = await pool.query(
            `UPDATE player
             SET current_character_id = $1
             WHERE discord_id = $2
             RETURNING *`,
            [characterId, discordId.trim()]
        );
        return result.rows[0];
    }

    async getCurrentCharacter(discordId) {
        const result = await pool.query(
            `SELECT current_character_id FROM player WHERE discord_id = $1`,
            [discordId.trim()]
        );
        return result.rows[0]?.current_character_id || null;
    }

    async setCurrentGame(discordId, gameId) {
        const result = await pool.query(
            `UPDATE player
             SET current_game_id = $1
             WHERE discord_id = $2
             RETURNING *`,
            [gameId, discordId.trim()]
        );
        return result.rows[0];
    }

    async getCurrentGame(discordId) {
        const result = await pool.query(
            `SELECT current_game_id FROM player WHERE discord_id = $1`,
            [discordId.trim()]
        );
        return result.rows[0]?.current_game_id || null;
    }

    async delete(discordId) {
        await pool.query(
            `DELETE FROM player WHERE discord_id = $1`,
            [discordId.trim()]
        );
    }
}

module.exports = PlayerDAO;
