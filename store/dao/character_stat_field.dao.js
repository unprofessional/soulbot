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

// store/dao/character_stat_field.dao.js

class CharacterStatFieldDAO {
    async create(characterId, templateId, value, meta = {}) {
        const sql = `
            INSERT INTO character_stat_field (character_id, template_id, value, meta)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (character_id, template_id)
            DO UPDATE SET value = EXCLUDED.value, meta = EXCLUDED.meta
            RETURNING *
        `;
        const params = [characterId, templateId, value, JSON.stringify(meta)];
        const result = await pool.query(sql, params);
        const row = result.rows[0];

        return {
            ...row,
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta || '{}') : row.meta || {}
        };
    }

    async bulkUpsert(characterId, statMap = {}) {
        const results = [];

        for (const [templateId, entry] of Object.entries(statMap)) {
            let value, meta;
            if (typeof entry === 'object' && entry !== null) {
                value = entry.value ?? '';
                meta = entry.meta ?? {};
            } else {
                value = entry;
                meta = {};
            }

            const updated = await this.create(characterId, templateId, value, meta);
            results.push(updated);
        }

        return results;
    }

    async findByCharacter(characterId) {
        const result = await pool.query(
            `SELECT template_id, value, meta FROM character_stat_field WHERE character_id = $1 ORDER BY template_id`,
            [characterId]
        );

        return result.rows.map(row => ({
            template_id: row.template_id,
            value: row.value,
            meta: typeof row.meta === 'string' ? JSON.parse(row.meta || '{}') : row.meta || {}
        }));
    }

    async deleteByCharacter(characterId) {
        await pool.query(`DELETE FROM character_stat_field WHERE character_id = $1`, [characterId]);
    }
}

module.exports = CharacterStatFieldDAO;
