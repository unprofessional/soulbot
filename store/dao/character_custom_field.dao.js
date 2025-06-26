// store/dao/character_custom_field.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class CharacterCustomFieldDAO {
    async create(characterId, name, value, meta = {}) {
        const sql = `
            INSERT INTO character_custom_field (character_id, name, value, meta)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (character_id, name)
            DO UPDATE SET value = EXCLUDED.value, meta = EXCLUDED.meta
            RETURNING *
        `;
        const result = await pool.query(sql, [characterId, name, value, JSON.stringify(meta)]);
        const row = result.rows[0];
        return {
            ...row,
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta || '{}') : row.meta || {},
        };
    }

    async bulkUpsert(characterId, fields = {}) {
        const results = [];
        for (const [name, entry] of Object.entries(fields)) {
            let value, meta;
            if (typeof entry === 'object' && entry !== null) {
                value = entry.value ?? '';
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
            `SELECT name, value, meta FROM character_custom_field WHERE character_id = $1 ORDER BY name`,
            [characterId]
        );

        return result.rows.map(row => ({
            name: row.name,
            value: row.value,
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta || '{}') : row.meta || {},
        }));
    }

    async deleteByCharacter(characterId) {
        await pool.query(`DELETE FROM character_custom_field WHERE character_id = $1`, [characterId]);
    }
}

module.exports = CharacterCustomFieldDAO;
