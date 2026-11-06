require('dotenv').config();
const { login, logout, profileName } = require('../features/openai/auth');
const { listModels } = require('../features/openai/inference');
const { withStore } = require('../features/openai/store');

async function main() {
    const [command = 'status', name = profileName()] = process.argv.slice(2);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)) {
        throw new Error('Use a profile name containing letters, numbers, underscores, or hyphens.');
    }
    process.env.CHATGPT_PROFILE = name;
    if (command === 'login') {
        await login(name);
        console.log(`Connected profile: ${name}. Manage plan and credit limits: https://chatgpt.com/settings/usage`);
    } else if (command === 'logout') {
        const revoked = await logout(name);
        console.log(`Signed out locally: ${name}.`);
        if (!revoked) console.log('Remote revocation was not confirmed. Disconnect SOULbot in ChatGPT Settings.');
    } else if (command === 'models') {
        console.table((await listModels()).map(model => ({ model: model.slug, name: model.display_name })));
    } else if (command === 'status') {
        await withStore(async store => {
            console.log(`Selected profile: ${name}`);
            console.table(Object.entries(store.accounts).map(([profile, account]) => ({
                profile, email: account.email || '', connected: Boolean(account.access_token),
                expires: account.expires_at ? new Date(account.expires_at).toISOString() : '',
            })));
        });
        console.log('Manage usage: https://chatgpt.com/settings/usage');
    } else {
        throw new Error('Usage: npm run chatgpt:auth -- <login|status|models|logout> [profile]');
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
