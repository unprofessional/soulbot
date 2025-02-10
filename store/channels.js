const DAO = require('./dao/store.dao.js');
require('dotenv').config();
const path = process.env.STORE_PATH;
const file = process.env.CHANNEL_STORE_FILE;
const filePath = `${path}/${file}`;
const channelDAO = new DAO(filePath);
const channels = channelDAO.initializeLocalStore().channels || [];
console.log('>>>>> channels: ', channels)

module.exports = { 
    channels,
};
