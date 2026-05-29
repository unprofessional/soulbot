// features/role-enforcement/role-enforcement.js

const { sendWebhookProxyMsg } = require('../twitter-core/webhook_utils');

const OWNER_PROXY_ROLE_NAME = 'owner-proxy';

// Goldy prefix & suffix phrases
const prefixes = [
    'wants you to know',
    'is still here',
    'wants attention',
    'desperately insists',
    'thinks she matters',
];

const catchPhrases = [
    'but its not like i care or anything',
    'but idrc',
    'but thats cringe',
    'but thats pathetic coded',
    'but shrug',
    'but seethe away',
    'but thats so cute',
    'but thats boring',
];

const getRandomPrefixes = () => prefixes[Math.floor(Math.random() * prefixes.length)];
const getRandomCatchPhrase = () => catchPhrases[Math.floor(Math.random() * catchPhrases.length)];

function getRoleNames(member) {
    const roles = member?.roles?.cache;
    if (!roles) return [];

    return Array.from(roles.values()).map(role => String(role?.name || '').toLowerCase());
}

/**
 * Enforces the "Goldy" role transformation by deleting and re-sending the message
 * via webhook impersonation with a custom phrase wrap.
 */
const enforceGoldyRole = async (message) => {
    if (!message.guild || message.author.bot) return;

    try {
        const member = await message.guild.members.fetch(message.author.id);
        const roleNames = member.roles.cache.map(role => role.name.toLowerCase());
        const hasGoldyRole = roleNames.includes('goldy');

        if (!hasGoldyRole) return;

        const randomPrefix = getRandomPrefixes();
        const randomCatchPhrase = getRandomCatchPhrase();
        const newContent = `<@${member.id}> ${randomPrefix}: ${message.content} ${randomCatchPhrase}`;

        await sendWebhookProxyMsg(message, newContent);
    } catch (err) {
        console.error('>>> enforceGoldyRole error:', err);
    }
};

/**
 * If the owner carries the owner-proxy role, replace their original message with
 * a webhook impersonation of that same content.
 */
const enforceOwnerProxyRole = async (message, ownerUserId = process.env.BOT_OWNER_ID || '818606180095885332') => {
    if (!message.guild || message.author.bot) return false;
    if (message.author.id !== ownerUserId) return false;

    const content = String(message.content || '').trim();
    if (!content) return false;

    try {
        const member = message.member || await message.guild.members.fetch(message.author.id);
        const roleNames = getRoleNames(member);
        const hasOwnerProxyRole = roleNames.includes(OWNER_PROXY_ROLE_NAME);

        if (!hasOwnerProxyRole) return false;

        await sendWebhookProxyMsg(message, content);
        return true;
    } catch (err) {
        console.error('>>> enforceOwnerProxyRole error:', err);
        return false;
    }
};

module.exports = {
    enforceGoldyRole,
    enforceOwnerProxyRole,
    getRoleNames,
};
