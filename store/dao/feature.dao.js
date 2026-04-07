const { pool } = require('../db/pool.js');

class FeatureDAO {
    async findAll() {
        const sql = `
            SELECT type, on
            FROM feature
            ORDER BY type ASC
        `;
        const result = await pool.query(sql);
        return result.rows;
    }

    async findByType(type) {
        const sql = `
            SELECT type, on
            FROM feature
            WHERE type = $1
            LIMIT 1
        `;
        const result = await pool.query(sql, [type]);
        return result.rows[0] || null;
    }

    async ensure(type, on = true) {
        const sql = `
            INSERT INTO feature (type, on)
            VALUES ($1, $2)
            ON CONFLICT (type) DO NOTHING
        `;
        await pool.query(sql, [type, on]);
    }

    async toggle(type) {
        await this.ensure(type, true);

        const sql = `
            UPDATE feature
            SET on = NOT on
            WHERE type = $1
            RETURNING type, on
        `;
        const result = await pool.query(sql, [type]);
        return result.rows[0] || null;
    }
}

module.exports = FeatureDAO;
