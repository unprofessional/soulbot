// features/rpg-tracker/utils/context_utils.js

const { saveInteraction, getRecentInteractionMessage } = require('../../../store/services/player_interaction.service');

/**
 * Persist the interaction context (i.e. a message ID for a user + game).
 * @param {string} userId - Discord user ID
 * @param {string} gameId - Game ID
 * @param {string} messageId - Discord message ID
 * @param {string} [interactionType] - Defaults to 'game_stat_template'
 */
async function persistInteractionContext(userId, gameId, messageId, interactionType = 'game_stat_template') {
    return saveInteraction({ userId, gameId, messageId, interactionType });
}

/**
 * Attempt to fetch the original message associated with an interaction.
 * Returns `null` if not found or expired (older than 10 min).
 * @param {object} interaction - Discord interaction (used to resolve channel)
 * @param {string} gameId
 * @param {string} [interactionType]
 * @returns {Promise<import('discord.js').Message|null>}
 */
async function getOriginalTrackedMessage(interaction, gameId, interactionType = 'game_stat_template') {
    const userId = interaction.user.id;
    const messageId = await getRecentInteractionMessage({ userId, gameId, interactionType });

    if (!messageId) return null;

    try {
        return await interaction.channel.messages.fetch(messageId);
    } catch (err) {
        console.warn('Failed to fetch tracked message:', err);
        return null;
    }
}

/**
 * Attempt to update a previously tracked message's embed + components.
 * Falls back to ephemeral reply if not found.
 * @param {object} interaction - Discord interaction (modal, button, etc.)
 * @param {string} gameId
 * @param {object} newEmbed - Embed to send
 * @param {Array} newComponents - Button rows
 * @param {string} [interactionType]
 */
async function updateTrackedMessageOrReply(interaction, gameId, newEmbed, newComponents, interactionType = 'game_stat_template') {
    const trackedMessage = await getOriginalTrackedMessage(interaction, gameId, interactionType);

    if (trackedMessage) {
        await trackedMessage.edit({ embeds: [newEmbed], components: newComponents });
        return await interaction.reply({ content: '✅ Updated.', ephemeral: true });
    } else {
        return await interaction.reply({
            content: '⚠️ Could not update the original message. It may have expired or been deleted.',
            ephemeral: true,
        });
    }
}

module.exports = {
    persistInteractionContext,
    getOriginalTrackedMessage,
    updateTrackedMessageOrReply,
};
