// message_listeners/core.js

const { Events } = require('discord.js');
const {
    enforceGoldyRole,
    enforceOwnerProxyRole,
} = require('../features/role-enforcement/role-enforcement.js');
const { handleSpeakEnglishRole } = require('../features/translation/auto_speak_english.js');
const { logMessage } = require('../logger/logger.js');
const { handleTwitterUrl } = require('../features/twitter-core/twitter_handler.js');
const { handleHilariousReactionAdd } = require('../features/reactions/hilarious_reacts.js');
const { updateMessage, deleteMessage } = require('../store/services/messages.service.js');
const { getFeature } = require('../store/features.js');
const { soulbotUserId } = require('../config/env_config.js');
const { shouldAcceptWork } = require('../app/lifecycle.js');

// Identity checks
const isABot = message => message.author.bot;
const isSelf = message => message.author.id === soulbotUserId;

async function initializeListeners(client) {
    client.on(Events.MessageCreate, async (message) => {
        if (!shouldAcceptWork()) {
            return;
        }

        const guildId = message.guildId;
        await logMessage(message);

        const isUser = !isSelf(message) && !isABot(message);

        if (isUser) {
            const consumedByOwnerProxy = await enforceOwnerProxyRole(message);
            if (consumedByOwnerProxy) return;

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
        if (!shouldAcceptWork()) {
            return;
        }

        if (!newMessage.partial && newMessage.content !== oldMessage.content) {
            console.log(`✏️ Message edited: ${newMessage.id}`);
            await updateMessage(newMessage.id, newMessage.content);
        }
    });

    // Message delete listener
    client.on(Events.MessageDelete, async (deletedMessage) => {
        if (!shouldAcceptWork()) {
            return;
        }

        if (!deletedMessage.partial) {
            console.log(`🗑️ Message deleted: ${deletedMessage.id}`);
            await deleteMessage(deletedMessage.id);
        }
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (!shouldAcceptWork()) {
            return;
        }

        try {
            await handleHilariousReactionAdd(reaction, user);
        } catch (error) {
            console.error('❗ Error handling hilarious reaction add:', error);
        }
    });

    return client;
}

module.exports = {
    initializeListeners,
};
