// store/services/player_interaction.service.js

const PlayerInteractionDAO = require('../dao/player_interaction.dao.js');
const dao = new PlayerInteractionDAO();

/**
 * Save or update a player's tracked interaction (e.g., from `/create-game`).
 */
async function saveInteraction({ playerId, gameId, messageId, interactionType = 'game_stat_template' }) {
    return dao.upsert({ playerId, gameId, messageId, interactionType });
}

/**
 * Retrieve a recent interaction message (within 10 minutes).
 */
async function getRecentInteractionMessage({ playerId, gameId, interactionType = 'game_stat_template' }) {
    return dao.getRecentMessageId({ playerId, gameId, interactionType });
}

/**
 * Manually clear a tracked interaction record (optional).
 */
async function clearInteraction({ playerId, gameId, interactionType = 'game_stat_template' }) {
    return dao.delete({ playerId, gameId, interactionType });
}

module.exports = {
    saveInteraction,
    getRecentInteractionMessage,
    clearInteraction,
};
