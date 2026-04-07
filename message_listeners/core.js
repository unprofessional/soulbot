// message_listeners/core.js

const { Events } = require('discord.js');
const { enforceGoldyRole } = require('../features/role-enforcement/role-enforcement.js');
const { handleSpeakEnglishRole } = require('../features/translation/auto_speak_english.js');
const { logMessage } = require('../logger/logger.js');
const { handleTwitterUrl } = require('../features/twitter-core/twitter_handler.js');
const { updateMessage, deleteMessage } = require('../store/services/messages.service.js');
const { getFeature } = require('../store/features.js');
const { soulbotUserId } = require('../config/env_config.js');

// Identity checks
const isABot = message => message.author.bot;
const isSelf = message => message.author.id === soulbotUserId;

async function initializeListeners(client) {
    client.on(Events.MessageCreate, async (message) => {
        const guildId = message.guildId;
        await logMessage(message);

        const isUser = !isSelf(message) && !isABot(message);

        if (isUser) {
            await enforceGoldyRole(message);
            await handleSpeakEnglishRole(message);

            const twitterFeature = await getFeature('twitter');
            if (twitterFeature?.on) {
                await handleTwitterUrl(message, { twitterFeature, guildId });
            }
        }
    });

    // Message update listener
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (!newMessage.partial && newMessage.content !== oldMessage.content) {
            console.log(`✏️ Message edited: ${newMessage.id}`);
            await updateMessage(newMessage.id, newMessage.content);
        }
    });

    // Message delete listener
    client.on(Events.MessageDelete, async (deletedMessage) => {
        if (!deletedMessage.partial) {
            console.log(`🗑️ Message deleted: ${deletedMessage.id}`);
            await deleteMessage(deletedMessage.id);
        }
    });

    return client;
}

module.exports = {
    initializeListeners,
};
