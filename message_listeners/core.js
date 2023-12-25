const { Events } = require('discord.js');
const {
    guilds,
    addGuild,
    getGuilds,
    removeGuild,
} = require("../store/guilds.js");
const {
    members,
    addMember,
    getMembers,
    // removeMember,
    nickNameIsAlreadySet,
} = require("../store/members.js");
const {
    fetchMetadata,
} = require('../features/fetch_metadata.js');

const {
    renderTwitterPost,
} = require('../features/render_twitter_post.js');

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

const initializeListeners = (client) => {

    /**
   * Listen to every message...
   */
    client.on(Events.MessageCreate, async (message) => {

        // Logger
        console.log(`${message.guildId}: ${message.author.globalName}: ${message.content}`);

        if(!isSelf(message)) { // not self, but can be anyone else
            /**
             * This is where the actual Twitter URL listener logic begins
             */
            const twitterUrlPattern = /https?:\/\/twitter\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
            const containsTwitterUrl = twitterUrlPattern.test(message.content);
            const xDotComUrlPattern = /https?:\/\/x\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
            const containsXDotComUrl = xDotComUrlPattern.test(message.content);
            console.log('>>>>> containsTwitterUrl: ', containsTwitterUrl);
            if(containsTwitterUrl) {
                const urls = containsXDotComUrl
                    ? message.content.match(xDotComUrlPattern)
                    : message.content.match(twitterUrlPattern);;
                // console.log('>>>>> urls: ', urls);
                // message.channel.send(`Twitter/X URL(s) found! urls: ${urls}`);

                const firstUrl = urls[0];
                const metadata = await fetchMetadata(firstUrl, message, containsXDotComUrl);

                if (metadata.error) {
                    message.reply(`Server 500!
\`\`\`HTML
${metadata.errorMsg}
\`\`\``
                    );
                } else {
                    // console.log('>>>>> fetchMetadata > metadata: ', JSON.stringify(metadata, null, 2));
                    renderTwitterPost(metadata, message);
                }
            }
        }

        if(!isSelf(message) && isOwner(message)) {

            console.log('>>>>> NOT self!!! Reading message!!');

            const guildId = message.guildId;

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
                const name = user.username;

                const contentArr = message.content.split('`');
                let prefix = contentArr[1];
                console.log('>>>>> contentArr: ', contentArr);
                console.log('>>>>> prefix: ', prefix);
                if (!prefix || contentArr.length < 3) {
                    message.channel.send(`You must specify a prefix in backticks (i.e. \`James\`)`);
                    return;
                }

                const cachedGuild = client.guilds.cache.get(guildId);
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
                    console.log('>>>>> Member nickname already set! ignoring...');
                    return;
                }
            }

            if(message.content.includes('!!! nicklist') && validationChecksHook(message)) {
                const memberList = getMembers(client, guildId);
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
