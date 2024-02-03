const { Pool } = require('pg');

/**
 * TODO TODO TODO
 * use ENV config....
 */
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'soulbot',
    password: 'pass1234',
    port: 5432,
});

pool.query('SELECT NOW()', (err, res) => {
    console.log(err, res);
    pool.end();
});
