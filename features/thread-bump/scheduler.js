// /features/thread-bump/scheduler.js

const { threadsToBump } = require('./config');
const { bumpThread } = require('./bump');

function startThreadBumpScheduler(client) {
    for (const thread of threadsToBump) {
        const intervalMs = thread.intervalHours * 60 * 60 * 1000;

        setInterval(() => {
            bumpThread(client, thread.threadId, thread.bumpMessage);
        }, intervalMs);

        console.log(`🕒 Scheduled thread bump every ${thread.intervalHours}h for ${thread.threadId}`);
    }
}

module.exports = { startThreadBumpScheduler };
