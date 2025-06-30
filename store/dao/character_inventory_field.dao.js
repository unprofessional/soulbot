// store/dao/character_inventory_field.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class CharacterInventoryFieldDAO {
    async create(inventoryId, name, value = '', meta = {}) {
        const sql = `
            INSERT INTO character_inventory_field (inventory_id, name, value, meta)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (inventory_id, name)
            DO UPDATE SET value = EXCLUDED.value, meta = EXCLUDED.meta
            RETURNING *
        `;
        const params = [inventoryId, name.trim(), value, JSON.stringify(meta)];
        const result = await pool.query(sql, params);
        return {
            ...result.rows[0],
            meta: JSON.parse(result.rows[0].meta || '{}'),
        };
    }

    async bulkUpsert(inventoryId, fieldMap = {}) {
        const results = [];

        for (const [name, entry] of Object.entries(fieldMap)) {
            const value = typeof entry === 'object' && entry !== null ? entry.value ?? '' : entry;
            const meta = typeof entry === 'object' && entry.meta ? entry.meta : {};
            const updated = await this.create(inventoryId, name, value, meta);
            results.push(updated);
        }

        return results;
    }

    async findByInventory(inventoryId) {
        const result = await pool.query(
            `SELECT name, value, meta FROM character_inventory_field WHERE inventory_id = $1 ORDER BY name`,
            [inventoryId]
        );

        return result.rows.map(row => ({
            name: row.name,
            value: row.value,
            meta: JSON.parse(row.meta || '{}')
        }));
    }

    async deleteByInventory(inventoryId) {
        await pool.query(
            `DELETE FROM character_inventory_field WHERE inventory_id = $1`,
            [inventoryId]
        );
    }

    async deleteById(fieldId) {
        await pool.query(
            `DELETE FROM character_inventory_field WHERE id = $1`,
            [fieldId]
        );
    }
}

module.exports = CharacterInventoryFieldDAO;
