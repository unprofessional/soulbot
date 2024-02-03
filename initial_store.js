const {
    accessSync,
    constants,
    writeFileSync,
} = require('node:fs');

/**
 * This uses locking Sync versions of methods due to the "run only once" nature
 * of this initialization module. You would use the async versions for any
 * other such runtime operations.
 * @param {*} filePath 
 */
const initializeDataStore = (filePath) => {

    console.log('>>>>> initializeDataStore reached!');

    try {
        accessSync(filePath, constants.F_OK);
        console.log(`>>>>> ${filePath} exists! No need to initialize...`);
    } catch (err) {
        console.error('>>>>> Some error occurred!: ', err);
        if(err.code === 'ENOENT') {
            // the `w` flag means create if not exists
            let content = '{}';
            const path = process.env.STORE_PATH;
            const featureFile = process.env.FEATURE_STORE_FILE;
            const featureFilePath = `${path}/${featureFile}`;
            console.log('>>>>> initializeDataStore > featureFilePath: ', featureFilePath);
            if(filePath === featureFilePath) {
                console.log('>>>>> initializeDataStore is featureFilePath!!!');
                content = JSON.stringify({
                    features: [
                        {
                            type: "twitter",
                            on: true,
                        },
                    ],
                }); // TODO: asbtract away to separate Constants file
            }

            writeFileSync(filePath, content, { flag: 'w', encoding: 'utf8' });
            console.log(`>>>>> File ${filePath} created.`);
        }
    }

};

module.exports = {
    initializeDataStore,
};
