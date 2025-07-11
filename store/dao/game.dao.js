// store/dao/game.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class GameDAO {
    async create({ name, description, created_by, guild_id = null }) {
        const sql = `
            INSERT INTO game (name, description, created_by, guild_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const params = [name, description, created_by.trim(), guild_id?.trim() ?? null];
        const result = await pool.query(sql, params);
        return result.rows[0];
    }

    async update(gameId, { name, description }) {
        const result = await pool.query(
            `
            UPDATE game
            SET name = $1,
                description = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
            `,
            [name.trim(), description?.trim() || null, gameId]
        );
        return result.rows[0] || null;
    }

    async findById(gameId) {
        const result = await pool.query(
            `SELECT * FROM game WHERE id = $1`,
            [gameId]
        );
        return result.rows[0] || null;
    }

    async findByUser(userId) {
        const result = await pool.query(
            `
            SELECT *
            FROM game
            WHERE created_by = $1
            ORDER BY created_at DESC
            `,
            [userId]
        );
        return result.rows;
    }

    async findByGuild(guildId) {
        if (!guildId) return [];
        const result = await pool.query(
            `SELECT * FROM game WHERE guild_id = $1`,
            [guildId.trim()]
        );
        return result.rows;
    }

    async findAll() {
        const result = await pool.query(`SELECT * FROM game ORDER BY created_at DESC`);
        return result.rows;
    }

    async delete(gameId) {
        await pool.query(`DELETE FROM game WHERE id = $1`, [gameId]);
    }

    async publish(gameId) {
        const result = await pool.query(
            `UPDATE game SET is_public = TRUE WHERE id = $1 RETURNING *`,
            [gameId]
        );
        return result.rows[0] || null;
    }

    async togglePublish(gameId) {
        const result = await pool.query(
            `
            UPDATE game
            SET is_public = NOT is_public,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [gameId]
        );
        return result.rows[0] || null;
    }


}

module.exports = GameDAO;
