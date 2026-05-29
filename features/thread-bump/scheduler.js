// /features/thread-bump/scheduler.js

const { threadsToBump } = require('./config');
const { bumpThread } = require('./bump');

function startThreadBumpScheduler(client) {
    const intervalHandles = [];

    for (const thread of threadsToBump) {
        const intervalMs = thread.intervalHours * 60 * 60 * 1000;

        const handle = setInterval(() => {
            bumpThread(client, thread.threadId, thread.bumpMessage);
        }, intervalMs);
        intervalHandles.push(handle);

        console.log(`🕒 Scheduled thread bump every ${thread.intervalHours}h for ${thread.threadId}`);
    }

    return () => {
        for (const handle of intervalHandles) {
            clearInterval(handle);
        }
    };
}

module.exports = { startThreadBumpScheduler };
