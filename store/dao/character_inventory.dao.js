// store/dao/character_inventory.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class CharacterInventoryDAO {
    async create({ characterId, name, type = null, description = null, equipped = false }) {
        const sql = `
            INSERT INTO character_inventory (character_id, name, type, description, equipped)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const params = [
            characterId,
            name,
            type || null,
            description || null,
            equipped
        ];
        const result = await pool.query(sql, params);
        return result.rows[0];
    }

    async findByCharacter(characterId) {
        const result = await pool.query(
            `SELECT * FROM character_inventory WHERE character_id = $1 ORDER BY name`,
            [characterId]
        );
        return result.rows;
    }

    async deleteByCharacter(characterId) {
        await pool.query(
            `DELETE FROM character_inventory WHERE character_id = $1`,
            [characterId]
        );
    }

    async deleteById(itemId) {
        await pool.query(
            `DELETE FROM character_inventory WHERE id = $1`,
            [itemId]
        );
    }

    async toggleEquipped(itemId, equipped) {
        const result = await pool.query(
            `UPDATE character_inventory
             SET equipped = $1
             WHERE id = $2
             RETURNING *`,
            [equipped, itemId]
        );
        return result.rows[0];
    }
}

module.exports = CharacterInventoryDAO;
