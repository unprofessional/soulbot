// /features/thread-bump/index.js

const { startThreadBumpScheduler } = require('./scheduler');

function initializeThreadBumpFeature(client) {
    return startThreadBumpScheduler(client);
}

module.exports = { initializeThreadBumpFeature };
