const { Events } = require('discord.js');
const { renderTwitterPost } = require('../features/twitter.js');
const {
    guilds,
} = require("../store/guilds.js");

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

const initializeTwitterListeners = (client) => {

    /**
   * Listen to every message...
   */
    client.on(Events.MessageCreate, async (message) => {

        // Logger
        console.log(`${message.guildId}: ${message.author.globalName}: ${message.content}`);

        if(!isSelf(message) && isOwner(message)) {

            console.log('>>>>> NOT self!!! Reading message!!');

            const guildId = message.guildId;
            /**
             * Only allow if they validate successfully
             */

            // const twitterUrlPattern = 'https://twitter.com/';
            const twitterUrlPattern = /^(https?:\/\/)?(www\.)?twitter\.com\/([a-zA-Z0-9_]+)(\/status\/[0-9]+)?\/?$/gm;
            const containsTwitterUrl = twitterUrlPattern.test(message.content);
            console.log('>>>>> containsTwitterUrl: ', containsTwitterUrl);

            /**
             * This is where the actual Twitter URL listener logic begins
             */
            if(containsTwitterUrl) {
                const wholeTwitterUrlPattern = /https?:\/\/twitter\.com\/[a-zA-Z0-9_]+\/status\/\d+/g;
                const twitterUrls = message.content.match(wholeTwitterUrlPattern);
                console.log('>>>>> twitterUrls: ', twitterUrls);
                message.channel.send(`Twitter URL(s) found! twitterUrls: ${twitterUrls}`);
                // renderTwitterPost(message, url);
            }

        }
        else {
            // else, isSelf or !isOwner, do nothing
            // console.log('>>>>> IS SELF... ignoring message...');
        }
    });

    return client;
};

module.exports = { initializeTwitterListeners };
