const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

function authDirectory() {
    return process.env.CHATGPT_AUTH_DIR || path.join(os.homedir(), '.config', 'soulbot', 'chatgpt');
}

// The CLI and bot share this lock so rotating refresh tokens cannot race.
async function withStore(callback) {
    const directory = authDirectory();
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const lock = path.join(directory, '.lock');
    const deadline = Date.now() + 35000;
    for (;;) {
        try {
            await fs.mkdir(lock, { mode: 0o700 });
            break;
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            if (Date.now() >= deadline) {
                throw new Error('ChatGPT credentials are locked. If no bot/auth process is running, remove CHATGPT_AUTH_DIR/.lock.');
            }
            await delay(100);
        }
    }
    const filename = path.join(directory, 'accounts.json');
    try {
        let store;
        try {
            store = JSON.parse(await fs.readFile(filename, 'utf8'));
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            store = { hostId: `urn:uuid:${randomUUID()}`, accounts: {} };
        }
        if (!store.hostId || !store.accounts) throw new Error('Invalid ChatGPT credential store.');
        const save = async () => {
            const temporary = `${filename}.${randomUUID()}.tmp`;
            try {
                await fs.writeFile(temporary, JSON.stringify(store), { mode: 0o600, flag: 'wx' });
                await fs.rename(temporary, filename);
            } finally {
                await fs.rm(temporary, { force: true });
            }
        };
        // Persist host identity even when first-time authorization is cancelled.
        await save();
        return await callback(store, save);
    } finally {
        await fs.rmdir(lock);
    }
}

module.exports = { authDirectory, withStore };
