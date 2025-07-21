// /features/thread-bump/bump.js

async function bumpThread(client, threadId, messageContent) {
    try {
        const thread = await client.channels.fetch(threadId);

        if (!thread || thread.archived) {
            console.warn(`⛔ Cannot bump thread ${threadId}: Not found or archived.`);
            return;
        }

        await thread.send(messageContent);
        console.log(`✅ Bumped thread ${thread.name} (${threadId})`);
    } catch (err) {
        console.error(`❌ Error bumping thread ${threadId}:`, err.message);
    }
}

module.exports = { bumpThread };
