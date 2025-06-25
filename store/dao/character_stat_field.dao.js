// store/dao/character_stat_field.dao.js

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
    async create(characterId, name, value, meta = {}) {
        const sql = `
            INSERT INTO character_stat_field (character_id, name, value, meta)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (character_id, name)
            DO UPDATE SET value = EXCLUDED.value, meta = EXCLUDED.meta
            RETURNING *
        `;
        const params = [characterId, name, value, JSON.stringify(meta)];
        const result = await pool.query(sql, params);
        return {
            ...result.rows[0],
            meta: JSON.parse(result.rows[0].meta || '{}')
        };
    }

    async bulkUpsert(characterId, statMap = {}) {
        const results = [];

        for (const [name, entry] of Object.entries(statMap)) {
            let value, meta;
            if (typeof entry === 'object' && entry !== null) {
                value = entry.value ?? 0;
                meta = entry.meta ?? {};
            } else {
                value = entry;
                meta = {};
            }

            const updated = await this.create(characterId, name, value, meta);
            results.push(updated);
        }

        return results;
    }

    async findByCharacter(characterId) {
        const result = await pool.query(
            `SELECT name, value, meta FROM character_stat_field WHERE character_id = $1 ORDER BY name`,
            [characterId]
        );

        return result.rows.map(row => ({
            name: row.name,
            value: row.value,
            meta: JSON.parse(row.meta || '{}')
        }));
    }

    async findSingle(characterId, name) {
        const result = await pool.query(
            `SELECT value FROM character_stat_field WHERE character_id = $1 AND name = $2`,
            [characterId, name]
        );
        return result.rows[0]?.value ?? null;
    }

    async deleteByCharacter(characterId) {
        await pool.query(
            `DELETE FROM character_stat_field WHERE character_id = $1`,
            [characterId]
        );
    }
}

module.exports = CharacterStatFieldDAO;
