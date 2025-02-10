const { Pool } = require('pg');

const {
    pgHost, pgPort, pgUser, pgPass, pgDb,
} = require('../../config/env_config.js');
const { getSql } = require('./sql-loader.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

const testPgConnection = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('PG Database connected:', res.rows[0].now);
    } catch (err) {
        console.error('Error connecting to the PG database:', err);
    }
};

const initializeDB = async () => {
    try {
        // Get SQL file content
        const sql = await getSql('tables', 'tables');

        // Execute SQL commands
        await pool.query(sql);
        console.log('PG Database initialized successfully.');
    } catch (err) {
        console.error('Error initializing the PG database:', err);
    }
};

module.exports = {
    testPgConnection,
    initializeDB,
};
