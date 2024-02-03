const DAO = require('./store.dao.js');
require('dotenv').config();
const path = process.env.STORE_PATH;
const file = process.env.FEATURE_STORE_FILE;
const filePath = `${path}/${file}`;
const metaDAO = new DAO(filePath);
const features = metaDAO.initializeLocalStore().features || [];
console.log('>>>>> features > features: ', features)

const toggleTwitter = (message) => {

    console.log('>>>>> toggleTwitter > features{1}: ', features)

    const twitterFeature = features.find((_feature) => _feature.type === 'twitter');
    const twitterFeatureIndex = features.findIndex((_feature) => _feature.type === 'twitter');

    console.log('>>>>> toggleTwitter > twitterFeatureIndex: ', twitterFeatureIndex)

    if(twitterFeatureIndex === -1) {
        message.reply(`Twitter feature not found!`);
    };

    if(twitterFeatureIndex !== -1) {
        features[twitterFeatureIndex].on = !twitterFeature.on;
        console.log('>>>>> toggleTwitter > features{2}: ', features);
        metaDAO.save({ features });
        message.reply(`Twitter functionality toggled to \`${features[twitterFeatureIndex].on}\``);
    }
};

module.exports = { 
    features,
    toggleTwitter,
};
