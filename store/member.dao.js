/**
 * For now, you'll note that all of the merging/data reconciliation is occurring
 * in the store controllers rather than these DAOs, which just expect entire
 * replacement JSON structures.
 * 
 * TODO: We might have to refactor this further with the findAll and save methods
 * pulled into an ORM layer???? Specifically for adding single entities
 */
const { readFile, writeFile } = require('node:fs').promises;
const PATH = process.env.DATA_STORE_PATH;

const findAll = async () => {
    const data = await readFile(PATH, err => {
        if (err) {
            console.error(err);
            return err;
        }
        return data;
    });
};

const save = async (replacementContent) => {
    await writeFile(PATH, replacementContent, err => {
        if (err) {
            console.error(err);
            return err;
        }
        // file written successfully
        return true;
    });
};

module.exports = {
    findAll,
    save,
};
