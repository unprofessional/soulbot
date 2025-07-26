// message_listeners/core.js

const { Events } = require('discord.js');
const { addGuild, getGuilds, removeGuild, guilds } = require('../store/guilds.js');
const { addMember, getMembers, nickNameIsAlreadySet } = require('../store/members.js');
const { features, toggleTwitter } = require('../store/features.js');
const { enforceGoldyRole } = require('../features/role-enforcement/role-enforcement.js');
const { sendPromptToOllama } = require('../features/ollama/index.js');
const { logMessage } = require('../logger/logger.js');
const { handleVisionCommand } = require('../features/ollama/vision_handler.js');
const { handleTwitterUrl } = require('../features/twitter-core/twitter_handler.js');

const twitterFeature = features.find(f => f.type === 'twitter');

// Validation for messages from supported servers
function validationChecksHook(message) {
    const checks = [
        () => {
            if (!guilds.includes(message.guildId)) {
                message.channel.send('Server not supported!!');
                return false;
            }
            return true;
        }
    ];
    return checks.every(check => check());
}

// Identity checks
const isABot = message => message.author.bot;
const isSelf = message => message.author.id === '891854264845094922';
const isOwner = message => message.author.id === '818606180095885332';

async function initializeListeners(client) {
    client.on(Events.MessageCreate, async (message) => {
        const guildId = message.guildId;
        const cachedGuild = client.guilds.cache.get(guildId);
        await logMessage(message);

        const isUser = !isSelf(message) && !isABot(message);

        if (isUser) {
            await enforceGoldyRole(message);

            if (twitterFeature.on) {
                await handleTwitterUrl(message, { twitterFeature, guildId });
            }

            if (message.content === '!!! vision' && validationChecksHook(message)) {
                await handleVisionCommand(message, 'default');
            }

            if (message.content === '!!! catvision' && validationChecksHook(message)) {
                await handleVisionCommand(message, 'catvision');
            }

        }

        // Owner-only commands
        if (isUser && isOwner(message)) {
            const content = message.content;

            if (content === '!!! serverinit') return addGuild(message.guildId, message);
            if (content === '!ping') return message.reply('Pong!!!');
            if (content === '!!! toggleTwitter') return toggleTwitter(message);

            if (content.includes('!!! llm') && validationChecksHook(message)) {
                const prompt = content.split('!!! llm')[1];
                const response = await sendPromptToOllama(prompt);
                return message.reply(response);
            }

            if (content === '!!! serverdel' && validationChecksHook(message)) {
                message.channel.send('Removing server from supported list...');
                return removeGuild(message.guildId);
            }

            if (content === '!!! serverlist' && validationChecksHook(message)) {
                const list = getGuilds(client);
                return message.channel.send(list.length > 0
                    ? `Current supported servers: ${list}`
                    : 'List is empty for now...');
            }

            if (content.includes('!!! nickadd') && validationChecksHook(message)) {
                const user = message.mentions.users.first();
                if (!user) return message.channel.send('You need to mention ONE user.');

                const parts = content.split('`');
                const prefix = parts[1];
                if (!prefix || parts.length < 3)
                    return message.channel.send('You must specify a prefix in backticks (i.e. `James`)');

                const member = cachedGuild.members.cache.get(user.id);
                const nickname = member?.nickname || user.username;

                if (!nickNameIsAlreadySet(nickname, prefix)) {
                    const newName = `[${prefix}] ${nickname}`.substring(0, 31);
                    try {
                        await member.setNickname(newName);
                        addMember(user, prefix, message);
                    } catch (err) {
                        message.channel.send('There was a problem trying to set the nickname for this user!');
                    }
                }
            }

            if (content.includes('!!! nicklist') && validationChecksHook(message)) {
                const members = await getMembers(client, guildId);
                return message.channel.send(members.length > 0
                    ? `Current controlled users: ${members}`
                    : 'List is empty for now...');
            }
        }
    });

    return client;
}

module.exports = {
    validationChecksHook,
    initializeListeners,
};
