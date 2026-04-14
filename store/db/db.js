const { getSql } = require('./sql-loader.js');
const { pool } = require('./pool.js');

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

const closeDB = async () => {
    await pool.end();
    console.log('PG Database pool closed.');
};

module.exports = {
    closeDB,
    testPgConnection,
    initializeDB,
};
