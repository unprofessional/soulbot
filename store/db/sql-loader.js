const fs = require('node:fs').promises;
const path = require('node:path');

const getSql = async (dirpath, filename) => {
    const sqlFilePath = path.join(__dirname, `${dirpath}`, `${filename}.sql`);
    return await fs.readFile(sqlFilePath, 'utf8');
};

module.exports = {
    getSql,
};
