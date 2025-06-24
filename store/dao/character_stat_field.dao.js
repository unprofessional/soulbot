const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class CharacterStatFieldDAO {
    async create(characterId, name, value) {
        const sql = `
      INSERT INTO character_stat_field (character_id, name, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (character_id, name)
      DO UPDATE SET value = EXCLUDED.value
      RETURNING *
    `;
        const result = await pool.query(sql, [characterId, name, value]);
        return result.rows[0];
    }

    async bulkUpsert(characterId, statMap = {}) {
        const entries = Object.entries(statMap);
        const results = [];

        for (const [name, value] of entries) {
            const updated = await this.create(characterId, name, value);
            results.push(updated);
        }

        return results;
    }

    async findByCharacter(characterId) {
        const result = await pool.query(
            `SELECT name, value FROM character_stat_field WHERE character_id = $1 ORDER BY name`,
            [characterId]
        );
        return result.rows; // Returns array of { name, value }
    }

    async findSingle(characterId, name) {
        const result = await pool.query(
            `SELECT value FROM character_stat_field WHERE character_id = $1 AND name = $2`,
            [characterId, name]
        );
        return result.rows[0]?.value ?? null;
    }

    async deleteByCharacter(characterId) {
        await pool.query(`DELETE FROM character_stat_field WHERE character_id = $1`, [characterId]);
    }
}

module.exports = CharacterStatFieldDAO;
