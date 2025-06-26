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
    // Create global player record if not exists
    async createGlobalPlayer(discordId) {
        const sql = `
            INSERT INTO player (discord_id)
            VALUES ($1)
            ON CONFLICT (discord_id) DO NOTHING
            RETURNING *
        `;
        const result = await pool.query(sql, [discordId.trim()]);
        return result.rows[0] || await this.findByDiscordId(discordId);
    }

    async findByDiscordId(discordId) {
        const result = await pool.query(
            `SELECT * FROM player WHERE discord_id = $1`,
            [discordId.trim()]
        );
        return result.rows[0] || null;
    }

    // Upsert per-server player context
    async upsertPlayerServerLink({ discordId, guildId, role = 'player', currentGameId = null, currentCharacterId = null }) {
        const player = await this.findByDiscordId(discordId);
        if (!player) throw new Error(`Player not found: ${discordId}`);

        const sql = `
            INSERT INTO player_server_link (player_id, guild_id, role, current_game_id, current_character_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (player_id, guild_id)
            DO UPDATE SET
                role = EXCLUDED.role,
                current_game_id = EXCLUDED.current_game_id,
                current_character_id = EXCLUDED.current_character_id,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        const params = [player.id, guildId, role, currentGameId, currentCharacterId];
        const result = await pool.query(sql, params);
        return result.rows[0];
    }

    async getServerLink(discordId, guildId) {
        const player = await this.findByDiscordId(discordId);
        if (!player) return null;

        const result = await pool.query(
            `SELECT * FROM player_server_link WHERE player_id = $1 AND guild_id = $2`,
            [player.id, guildId]
        );
        return result.rows[0] || null;
    }

    async setCurrentGame(discordId, guildId, gameId) {
        const link = await this.getServerLink(discordId, guildId);
        if (!link) throw new Error(`No player-server link found for ${discordId} in guild ${guildId}`);

        const result = await pool.query(
            `UPDATE player_server_link
             SET current_game_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE player_id = $2 AND guild_id = $3
             RETURNING *`,
            [gameId, link.player_id, guildId]
        );
        return result.rows[0];
    }

    async getCurrentGame(discordId, guildId) {
        const link = await this.getServerLink(discordId, guildId);
        return link?.current_game_id || null;
    }

    async setCurrentCharacter(discordId, guildId, characterId) {
        const link = await this.getServerLink(discordId, guildId);
        if (!link) throw new Error(`No player-server link found for ${discordId} in guild ${guildId}`);

        const result = await pool.query(
            `UPDATE player_server_link
             SET current_character_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE player_id = $2 AND guild_id = $3
             RETURNING *`,
            [characterId, link.player_id, guildId]
        );
        return result.rows[0];
    }

    async getCurrentCharacter(discordId, guildId) {
        const link = await this.getServerLink(discordId, guildId);
        return link?.current_character_id || null;
    }

    async delete(discordId) {
        const player = await this.findByDiscordId(discordId);
        if (!player) return;
        await pool.query(`DELETE FROM player_server_link WHERE player_id = $1`, [player.id]);
        await pool.query(`DELETE FROM player WHERE id = $1`, [player.id]);
    }
}

module.exports = PlayerDAO;
