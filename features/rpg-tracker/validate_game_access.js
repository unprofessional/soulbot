// utils/validate_game_access.js

const { getGame } = require('../../store/services/game.service');

/**
 * Checks whether a user can still interact with a game's content.
 * @param {object} game - The game object (if already retrieved).
 * @param {string} gameId - The game ID (if not already passed as an object).
 * @param {string} userId - The Discord user ID.
 * @returns {Promise<{ valid: boolean, warning?: string }>} - Status and optional warning message.
 */
async function validateGameAccess({ game = null, gameId = null, userId }) {
    let resolvedGame = game;

    if (!resolvedGame && gameId) {
        resolvedGame = await getGame({ id: gameId });
    }

    if (!resolvedGame) {
        return {
            valid: false,
            warning: '⚠️ This character\'s game no longer exists.',
        };
    }

    if (!resolvedGame.is_public && resolvedGame.created_by !== userId) {
        return {
            valid: true,
            warning: '⚠️ This game is no longer public. You can still view your character, but new players cannot join.',
        };
    }

    return { valid: true };
}

module.exports = { validateGameAccess };
