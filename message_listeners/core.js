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
                    let metadata = await fetchMetadata(firstUrl, message, containsXDotComUrl);
                    if(metadata.qrtURL) {
                        const qtMetadata = await fetchQTMetadata(metadata.qrtURL, message, containsXDotComUrl);
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
                message.channel.reply(response);
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

module.exports = { initializeListeners };
