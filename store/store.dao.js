const { readFileSync } = require('node:fs');
const { readFile, writeFile } = require('node:fs').promises;

class DAO {

    constructor(filePath) {
        this.filePath = filePath;
    }

    initializeLocalStore() {
        try {
            const data = JSON.parse(readFileSync(this.filePath));
            console.log('>>>>> initialize > readFileSync > data: ', data);
            return data;
        } catch (err) {
            console.error(err);
            return err;
        }
    }

    async findAll() {
        try {
            const data = await readFile(this.filePath);
            return data;
        } catch (err) {
            console.error(err);
            return err;
        }
    }
  
    async save(replacementContent) {
        await writeFile(this.filePath, JSON.stringify(replacementContent, null, 4), err => {
            if (err) {
                console.error(err);
                return err;
            }
            // file written successfully
            return true;
        });
    }

}
  
module.exports = DAO;