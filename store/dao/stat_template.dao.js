// store/dao/stat_template.dao.js

const { Pool } = require('pg');
const { pgHost, pgPort, pgUser, pgPass, pgDb } = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

class StatTemplateDAO {
    async create({ game_id, label, field_type = 'short', default_value = null, is_required = true, sort_order = 0, meta = {} }) {
        const sql = `
            INSERT INTO stat_template (
                game_id, label, field_type, default_value, is_required, sort_order, meta
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const result = await pool.query(sql, [
            game_id,
            label,
            field_type,
            default_value,
            is_required,
            sort_order,
            meta,
        ]);
        return result.rows[0];
    }

    async bulkCreate(gameId, templateList = []) {
        const created = [];
        for (const tmpl of templateList) {
            const createdTemplate = await this.create({
                ...tmpl,
                game_id: gameId,
            });
            created.push(createdTemplate);
        }
        return created;
    }

    async findByGame(gameId) {
        const sql = `
            SELECT * FROM stat_template
            WHERE game_id = $1
            ORDER BY sort_order ASC, label ASC
        `;
        const result = await pool.query(sql, [gameId]);
        return result.rows;
    }

    async deleteByGame(gameId) {
        await pool.query(`DELETE FROM stat_template WHERE game_id = $1`, [gameId]);
    }

    async deleteById(templateId) {
        await pool.query(`DELETE FROM stat_template WHERE id = $1`, [templateId]);
    }
}

module.exports = StatTemplateDAO;
