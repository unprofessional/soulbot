const { Pool } = require('pg');

const {
    pgHost, pgPort, pgUser, pgPass, pgDb,
} = require('../../config/env_config.js');

const pool = new Pool({
    user: pgUser,
    host: pgHost,
    database: pgDb,
    password: pgPass,
    port: pgPort,
});

const testPgConnection = async () => {
    return pool.query('SELECT NOW()', (err, res) => {
        console.log(err, res);
        pool.end();
    });
};

module.exports = {
    testPgConnection,
};
