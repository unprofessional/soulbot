const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class PlayerInteractionDAO {
    /**
     * Upserts a player's interaction context message for a game + interaction type.
     */
    async upsert({ userId, gameId, messageId, interactionType = 'game_stat_template' }) {
        const sql = `
            INSERT INTO player_interactions (user_id, game_id, message_id, interaction_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, game_id, interaction_type)
            DO UPDATE SET
                message_id = EXCLUDED.message_id,
                created_at = CURRENT_TIMESTAMP
        `;
        await pool.query(sql, [userId, gameId, messageId, interactionType]);
    }

    /**
     * Retrieve the most recent message for this interaction type.
     * Returns null if older than 10 minutes.
     */
    async getRecentMessageId({ userId, gameId, interactionType = 'game_stat_template' }) {
        const sql = `
            SELECT message_id FROM player_interactions
            WHERE user_id = $1 AND game_id = $2 AND interaction_type = $3
              AND created_at > NOW() - INTERVAL '10 minutes'
        `;
        const result = await pool.query(sql, [userId, gameId, interactionType]);
        return result.rows[0]?.message_id || null;
    }

    /**
     * (Optional) Delete an interaction record — useful if manually clearing state.
     */
    async delete({ userId, gameId, interactionType = 'game_stat_template' }) {
        const sql = `
            DELETE FROM player_interactions
            WHERE user_id = $1 AND game_id = $2 AND interaction_type = $3
        `;
        await pool.query(sql, [userId, gameId, interactionType]);
    }
}

module.exports = PlayerInteractionDAO;
