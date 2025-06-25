// store/dao/character.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class CharacterDAO {
    async create({ user_id, game_id, name, class: clazz, race, level = 1, notes = null }) {
        const sql = `
            INSERT INTO character (user_id, game_id, name, class, race, level, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const params = [
            user_id.trim(),
            game_id,
            name,
            clazz || null,
            race || null,
            level,
            notes,
        ];
        const result = await pool.query(sql, params);
        return result.rows[0];
    }

    async findById(characterId) {
        const result = await pool.query(
            `SELECT * FROM character WHERE id = $1`,
            [characterId]
        );
        return result.rows[0] || null;
    }

    async findByUser(userId) {
        const result = await pool.query(
            `SELECT * FROM character WHERE user_id = $1`,
            [userId.trim()]
        );
        return result.rows;
    }

    async findByGame(gameId) {
        const result = await pool.query(
            `SELECT * FROM character WHERE game_id = $1`,
            [gameId]
        );
        return result.rows;
    }

    async findAll() {
        const result = await pool.query(`SELECT * FROM character ORDER BY created_at DESC`);
        return result.rows;
    }

    async updateMeta(characterId, { name, class: clazz, race, level, notes }) {
        const sql = `
            UPDATE character
            SET name = $1,
                class = $2,
                race = $3,
                level = $4,
                notes = $5
            WHERE id = $6
            RETURNING *
        `;
        const result = await pool.query(
            sql,
            [name, clazz || null, race || null, level, notes, characterId]
        );
        return result.rows[0];
    }

    async delete(characterId) {
        await pool.query(
            `DELETE FROM character WHERE id = $1`,
            [characterId]
        );
    }
}

module.exports = CharacterDAO;
