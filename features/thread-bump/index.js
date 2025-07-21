// /features/thread-bump/index.js

const { startThreadBumpScheduler } = require('./scheduler');

function initializeThreadBumpFeature(client) {
    startThreadBumpScheduler(client);
}

module.exports = { initializeThreadBumpFeature };
