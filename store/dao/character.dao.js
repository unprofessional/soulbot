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
    async create({ user_id, game_id, name, avatar_url = null, bio = null, visibility = 'private' }) {
        const sql = `
            INSERT INTO character (user_id, game_id, name, avatar_url, bio, visibility)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const params = [
            user_id.trim(),
            game_id,
            name,
            avatar_url,
            bio,
            visibility,
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

    async updateMeta(characterId, { name, avatar_url, bio, visibility }) {
        const sql = `
            UPDATE character
            SET name = $1,
                avatar_url = $2,
                bio = $3,
                visibility = $4
            WHERE id = $5
            RETURNING *
        `;
        const result = await pool.query(
            sql,
            [name, avatar_url || null, bio || null, visibility || 'private', characterId]
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
