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
    async create({ user_id, game_id, name, class: clazz, race, level = 1, hp = 10, max_hp = 10, notes }) {
        const sql = `
      INSERT INTO characters (user_id, game_id, name, class, race, level, hp, max_hp, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
        const params = [user_id, game_id, name, clazz, race, level, hp, max_hp, notes];
        const result = await pool.query(sql, params);
        return result.rows[0];
    }

    async findById(characterId) {
        const result = await pool.query(`SELECT * FROM characters WHERE id = $1`, [characterId]);
        return result.rows[0] || null;
    }

    async findByUser(userId) {
        const result = await pool.query(`SELECT * FROM characters WHERE user_id = $1`, [userId]);
        return result.rows;
    }

    async findByGame(gameId) {
        const result = await pool.query(`SELECT * FROM characters WHERE game_id = $1`, [gameId]);
        return result.rows;
    }

    async updateHP(characterId, hp, max_hp) {
        const sql = `UPDATE characters SET hp = $1, max_hp = $2 WHERE id = $3 RETURNING *`;
        const result = await pool.query(sql, [hp, max_hp, characterId]);
        return result.rows[0];
    }

    async updateMeta(characterId, { name, class: clazz, race, level, notes }) {
        const sql = `
      UPDATE characters
      SET name = $1, class = $2, race = $3, level = $4, notes = $5
      WHERE id = $6
      RETURNING *
    `;
        const result = await pool.query(sql, [name, clazz, race, level, notes, characterId]);
        return result.rows[0];
    }

    async delete(characterId) {
        await pool.query(`DELETE FROM characters WHERE id = $1`, [characterId]);
    }
}

module.exports = CharacterDAO;
