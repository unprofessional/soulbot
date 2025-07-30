// features/role-enforcement/role-enforcement.js

const { sendWebhookProxyMsg } = require('../twitter-core/webhook_utils');

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

module.exports = { enforceGoldyRole };
