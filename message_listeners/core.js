// message_listeners/core.js

const { Events } = require('discord.js');
const { addGuild, getGuilds, removeGuild, guilds } = require('../store/guilds.js');
const { addMember, getMembers, nickNameIsAlreadySet } = require('../store/members.js');
const { features, toggleTwitter } = require('../store/features.js');
const { fetchMetadata, fetchQTMetadata } = require('../features/twitter-core/fetch_metadata.js');
const { renderTwitterPost } = require('../features/twitter-core/render_twitter_post.js');
const { enforceGoldyRole } = require('../features/role-enforcement/role-enforcement.js');
const { sendPromptToOllama } = require('../features/ollama/index.js');
const { fetchImageAsBase64 } = require('../features/ollama/vision.js');
const { logMessage } = require('../logger/logger.js');
const { stripQueryParams } = require('../features/twitter-core/utils.js');
const { findMessagesByLink } = require('../store/services/messages.service.js');

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

// Twitter link detection helpers
const KNOWN_X_DOMAINS = ['twitter.com', 'x.com', 'fixupx.com', 'vxtwitter.com', 'fxtwitter.com'];
const twitterUrlRegex = /https?:\/\/([\w.-]+)\/\w+\/status\/(?<statusId>\d+)/gi;

function extractTwitterStatus(messageContent) {
    const matches = [...messageContent.matchAll(twitterUrlRegex)];
    if (matches.length === 0) return null;
    const match = matches[0];
    const { statusId } = match.groups;
    const domain = match[1].toLowerCase();
    const isKnownDomain = KNOWN_X_DOMAINS.includes(domain);
    const isModernId = statusId.length >= 15;
    return (isKnownDomain && (isModernId || domain === 'twitter.com' || domain === 'x.com')) ? match[0] : null;
}

async function initializeListeners(client) {
    client.on(Events.MessageCreate, async (message) => {
        const guildId = message.guildId;
        const cachedGuild = client.guilds.cache.get(guildId);
        await logMessage(message);

        const isUser = !isSelf(message) && !isABot(message);

        if (isUser) {
            await enforceGoldyRole(message);

            if (twitterFeature.on) {
                const matchedUrl = extractTwitterStatus(message.content);
                if (matchedUrl) {
                    console.log('\n✅ Valid Twitter/X status detected:', matchedUrl);
                }

                const twitterPattern = /https?:\/\/twitter\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
                const xDotPattern = /https?:\/\/x\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
                const containsTwitterUrl = twitterPattern.test(message.content);
                const containsXDotComUrl = xDotPattern.test(message.content);

                if (containsTwitterUrl || containsXDotComUrl) {
                    await message.suppressEmbeds(true);
                    const urls = (containsXDotComUrl ? message.content.match(xDotPattern) : message.content.match(twitterPattern)) || [];
                    const firstUrl = stripQueryParams(urls[0]);

                    const found = await findMessagesByLink(guildId, message.id, firstUrl);
                    const prior = found?.filter(msg => String(msg.message_id) !== String(message.id))[0];

                    if (prior) {
                        const channelId = prior.meta?.thread_id ? prior.meta.threadId : prior.channel_id;
                        const link = `https://discord.com/channels/${guildId}/${channelId}/${prior.message_id}`;
                        return message.reply(`Someone already posted this here: ${link}`);
                    }

                    try {
                        const metadata = await fetchMetadata(firstUrl, message, containsXDotComUrl);
                        if (metadata?.error) {
                            return message.reply('Post unavailable! Deleted or protected mode?');
                        }

                        if (metadata.qrtURL) {
                            const qt = await fetchQTMetadata(metadata.qrtURL, message, containsXDotComUrl);
                            metadata.qtMetadata = qt;
                        }

                        if (metadata.error) {
                            return message.reply(`Server 500!\n\`\`\`HTML\n${metadata.errorMsg}\n\`\`\``);
                        }

                        console.log('>>>>> core detect > firstUrl: ', firstUrl);
                        await renderTwitterPost(metadata, message, firstUrl);

                    } catch (err) {
                        console.error('Metadata fetch error:', err);
                    }
                }
            }

            if (message.content === '!!! vision' && validationChecksHook(message)) {
                const images = message.attachments.filter(att => att.contentType?.startsWith('image/'));
                if (images.size > 0) {
                    await message.channel.send('Processing your image, please wait...');
                    for (const [, image] of images) {
                        try {
                            const base64 = await fetchImageAsBase64(image.url);
                            const prompt = message.content || 'Analyze this image. Please be brief and concise.';
                            const result = await sendPromptToOllama(prompt, base64);
                            await message.reply(`Response:\n\n${result}`);
                        } catch (error) {
                            console.error(error);
                            await message.reply('An error occurred while processing your image.');
                        }
                    }
                }
            }

            if (message.content === '!!! catvision' && validationChecksHook(message)) {
                const images = message.attachments.filter(att => att.contentType?.startsWith('image/'));
                if (images.size > 0) {
                    await message.channel.send('Processing your image, please wait...');
                    for (const [, image] of images) {
                        try {
                            const base64 = await fetchImageAsBase64(image.url);
                            const result = await sendPromptToOllama(undefined, base64, 'catvision');
                            await message.reply(result);
                        } catch (error) {
                            console.error(error);
                            await message.reply('An error occurred while processing your image.');
                        }
                    }
                }
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
