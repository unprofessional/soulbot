const PlayerInteractionDAO = require('../dao/player_interaction.dao.js');
const dao = new PlayerInteractionDAO();

/**
 * Save or update a user's tracked interaction (like `/create-game` stat setup).
 */
async function saveInteraction({ userId, gameId, messageId, interactionType = 'game_stat_template' }) {
    return dao.upsert({ userId, gameId, messageId, interactionType });
}

/**
 * Retrieve a recent interaction message (within 10 minutes).
 */
async function getRecentInteractionMessage({ userId, gameId, interactionType = 'game_stat_template' }) {
    return dao.getRecentMessageId({ userId, gameId, interactionType });
}

/**
 * Manually clear a tracked interaction record (optional).
 */
async function clearInteraction({ userId, gameId, interactionType = 'game_stat_template' }) {
    return dao.delete({ userId, gameId, interactionType });
}

module.exports = {
    saveInteraction,
    getRecentInteractionMessage,
    clearInteraction,
};
