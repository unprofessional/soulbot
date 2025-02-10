const { Events } = require('discord.js');
const {
    guilds,
    addGuild,
    getGuilds,
    removeGuild,
} = require("../store/guilds.js");
const {
    addMember,
    getMembers,
    nickNameIsAlreadySet,
} = require("../store/members.js");
const {
    features,
    toggleTwitter,
} = require("../store/features.js");

const twitterFeature = features.find(feature => feature.type === 'twitter');

const {
    fetchMetadata,
    fetchQTMetadata,
} = require('../features/twitter-core/fetch_metadata.js');

const {
    renderTwitterPost,
} = require('../features/twitter-core/render_twitter_post.js');
const { enforceGoldyRole } = require('../features/role-enforcement/role-enforcement.js');
const { sendPromptToOllama } = require('../features/ollama/index.js');
const { fetchImageAsBase64 } = require('../features/ollama/vision.js');
const { logMessage } = require('../logger/logger.js');

// TODO: Move to "Message Validation"?
const validationChecksHook = (message) => {

    const validationChecks = [];
    // TODO: Assign to object and iterate through to assign to array?
    const serverIsSupported = () => {
        if(!guilds.includes(message.guildId)) {
            message.channel.send('Server not supported!!');
            return false;
        }
        return true;
    };
    validationChecks.push(serverIsSupported);
    return validationChecks.every((check) => check());
};

// any bot
const isABot = (message) => {
    if(message.author.bot) return true;
    return false;
};


// bot
const isSelf = (message) => {
    if(message.author.id === '891854264845094922') return true;
    return false;
};

// me
const isOwner = (message) => {
    if(message.author.id === '818606180095885332') return true;
    return false;
};

const initializeListeners = async (client) => {

    /**
     * Listen to every message...
     */
    client.on(Events.MessageCreate, async (message) => {

        // Logger
        // THIS IS SPAMMY, ONLY USE FOR DEBUGGING!
        // console.log(`${message.guildId}: ${message.author.globalName}: ${message.content}`);
        await logMessage(message);

        if(!isSelf(message) && !isABot(message)) { // not self or a bot, but can be anyone else

            await enforceGoldyRole(message);

            /**
             * This is where the actual Twitter URL listener logic begins
             */
            if(twitterFeature.on) {
                const twitterUrlPattern = /https?:\/\/twitter\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
                const containsTwitterUrl = twitterUrlPattern.test(message.content);
                const xDotComUrlPattern = /https?:\/\/x\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
                const containsXDotComUrl = xDotComUrlPattern.test(message.content);
                // console.log('>>>>> containsTwitterUrl: ', containsTwitterUrl);
                // console.log('>>>>> containsXDotComUrl: ', containsXDotComUrl);
                if(containsTwitterUrl || containsXDotComUrl) {
                    await message.suppressEmbeds(true);
                    const urls = containsXDotComUrl
                        ? message.content.match(xDotComUrlPattern)
                        : message.content.match(twitterUrlPattern);
                    // console.log('>>>>> urls: ', urls);
                    // message.channel.send(`Twitter/X URL(s) found! urls: ${urls}`);
    
                    const firstUrl = urls[0];
                    let metadata = {};

                    try {
                        metadata = await fetchMetadata(firstUrl, message, containsXDotComUrl);
                        console.log('>>>>> containsTwitterUrl > CALL-fetchMetadata > metadata: ', metadata);
                    }
                    catch(err) {
                        console.log('>>>>> containsTwitterUrl > CALL-fetchMetadata > err: ', err);
                    }

                    if(metadata?.error) {
                        message.reply('Post unavailable! Deleted or protected mode?');
                    } else {
                        if(metadata.qrtURL) {
                            const qtMetadata = await fetchQTMetadata(metadata.qrtURL, message, containsXDotComUrl);
                            console.log('>>>>> core > qtMetadata: ', qtMetadata);
                            metadata.qtMetadata = qtMetadata;
                        }
        
                        if (metadata.error) {
                            message.reply(`Server 500!
        \`\`\`HTML
        ${metadata.errorMsg}
        \`\`\``
                            );
                        } else {
                            // console.log('>>>>> fetchMetadata > metadata: ', JSON.stringify(metadata, null, 2));
                            await renderTwitterPost(metadata, message, containsTwitterUrl);
                            // await message.suppressEmbeds(true);
                        }
                    }
                }
            }

            if (message.content === '!!! vision' && validationChecksHook(message)) {
                /**
                 * Ollama Vision
                 */
                const images = message.attachments.filter(att => att.contentType?.startsWith('image/'));
                if (images.size > 0) {
                    await message.channel.send('Processing your image, please wait...');
                    for (const [_, image] of images) {
                        try {
                            // const localPath = `/tempdata/${image.name}`;
                            console.log('>>>>> core.js > image attached! analysis localPath: ', image.url);
                            // await downloadImage(image.url, localPath);
                            // if (!fs.existsSync(localPath)) {
                            //     console.error(`File not found at path: ${localPath}`);
                            //     throw new Error('Image download failed');
                            // }
                            // Convert the image to Base64
                            const base64Image = await fetchImageAsBase64(image.url);
                            console.log("Base64 Image String Preview:", base64Image.slice(0, 100));

                            const userPrompt = message.content || 'Analyze this image. Please be brief and concise. If you do not know what it is, then just say so.';
                            const response = await sendPromptToOllama(userPrompt, base64Image);
                            console.log('>>>>> core.js > image attached! analysis response: ', response);
                            await message.reply(`Response:\n\n${response}`);
                        } catch (error) {
                            console.error(error);
                            await message.reply('An error occurred while processing your image.');
                        }
                    }
                }
            }

            if (message.content === '!!! catvision' && validationChecksHook(message)) {
                /**
                 * Ollama Vision
                 */
                const images = message.attachments.filter(att => att.contentType?.startsWith('image/'));
                if (images.size > 0) {
                    await message.channel.send('Processing your image, please wait...');
                    for (const [_, image] of images) {
                        try {
                            // const localPath = `/tempdata/${image.name}`;
                            console.log('>>>>> core.js > image attached! analysis localPath: ', image.url);

                            // Convert the image to Base64
                            const base64Image = await fetchImageAsBase64(image.url);
                            console.log("Base64 Image String Preview:", base64Image.slice(0, 100));

                            // catvision prompt always gets overwritten anyway
                            const response = await sendPromptToOllama(undefined, base64Image, 'catvision');
                            console.log('>>>>> core.js > image attached! analysis response: ', response);
                            await message.reply(response);
                        } catch (error) {
                            console.error(error);
                            await message.reply('An error occurred while processing your image.');
                        }
                    }
                }
            }
        }

        if(!isSelf(message) && !isABot(message) && isOwner(message)) {

            // console.log('>>>>> NOT self!!! Reading message!!');

            const guildId = message.guildId;
            const cachedGuild = client.guilds.cache.get(guildId);

            /**
             * Unvalidated
             */
            // Add server to supported list
            if (message.content === '!!! serverinit') {
                addGuild(message.guildId, message);
            }

            if (message.content === '!ping') {
                message.reply('Pong!!!');
            }

            if (message.content === '!!! toggleTwitter') {
                toggleTwitter(message);
            }

            if (message.content.includes('!!! llm') && validationChecksHook(message)) {
                const content = message.content;
                console.log('>>>>> core > if !!! llm > content: ', content);
                const prompt = content.split('!!! llm')[1];
                console.log('>>>>> core > if !!! llm > prompt: ', prompt);
                const response = await sendPromptToOllama(prompt);
                console.log('>>>>> core > if !!! llm > response: ', response);
                message.reply(response);
            }

            /**
             * Only allow if they validate successfully
             */
            if (message.content === '!!! serverdel' && validationChecksHook(message)) {
                message.channel.send('Removing server from supported list...');
                removeGuild(message.guildId);
            }
  
            if (message.content === '!!! serverlist' && validationChecksHook(message)) {
                const guildList = getGuilds(client)
                if(guildList.length > 0) {
                    message.channel.send(`Current supported servers: ${guildList}`);
                } else {
                    message.channel.send('List is empty for now...');
                }
            }

            /**
             * Exclusive to manual first adds to the "controlled user" list
             * 
             * For subsequent user-initiated nickname updates, see `guild_member_updates.js`
             */
            if(message.content.includes('!!! nickadd') && validationChecksHook(message)) {
                // Allow only one mention
                // TODO: Reject any with multiple mentions
                const user = message.mentions.users.first();
                // console.log('>>>>> user: ', user);
                if (user === undefined) {
                    message.channel.send(`You need to mention ONE user.`);
                    return;
                }
                // const name = user.username;

                const contentArr = message.content.split('`');
                let prefix = contentArr[1];
                // console.log('>>>>> contentArr: ', contentArr);
                // console.log('>>>>> prefix: ', prefix);
                if (!prefix || contentArr.length < 3) {
                    message.channel.send(`You must specify a prefix in backticks (i.e. \`James\`)`);
                    return;
                }

                // console.log('>>>>> cachedGuild: ', cachedGuild);
                const cachedMember = cachedGuild.members.cache.get(user.id);
                // console.log('>>>>> cachedMember: ', cachedMember);
                const nickname = cachedMember.nickname;
                // console.log('>>>>> nickname: ', nickname);
                if(!nickNameIsAlreadySet(nickname, prefix)) {
                    const replacementNickname = `[${prefix}] ${nickname || user.username}`.substring(0,31);
                    try {
                        await cachedMember.setNickname(replacementNickname);
                        // Add to "controlled users" list
                        addMember(user, prefix, message);
                    }
                    catch (err) {
                        message.channel.send('There was a problem trying to set the nickname for this user!');
                    }
                }
                else {
                    // console.log('>>>>> Member nickname already set! ignoring...');
                    return;
                }
            }

            if(message.content.includes('!!! nicklist') && validationChecksHook(message)) {
                const memberList = await getMembers(client, guildId);
                if(memberList.length > 0) {
                    message.channel.send(`Current controlled users: ${memberList}`);
                } else {
                    message.channel.send('List is empty for now...');
                }
            }

        }
        else {
            // else, isSelf or !isOwner, do nothing
            // console.log('>>>>> IS SELF... ignoring message...');
        }
    });

    return client;
};

module.exports = {
    validationChecksHook,
    initializeListeners,
};
