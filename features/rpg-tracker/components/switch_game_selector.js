// features/rpg-tracker/components/switch_game_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const {
    getGamesByUser,
} = require('../../../store/services/game.service');

const {
    getOrCreatePlayer,
    setCurrentGame,
} = require('../../../store/services/player.service');

const {
    validateGameAccess,
} = require('../validate_game_access');

const id = 'switchGameDropdown';

/**
 * Builds a dropdown of accessible games in the current server
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<{ content: string, ephemeral: true } | { content: string, components: ActionRowBuilder[], ephemeral: true }>}
 */
async function build(userId, guildId) {
    const allGames = await getGamesByUser(userId, guildId);
    const accessibleGames = [];

    for (const game of allGames) {
        const { valid } = await validateGameAccess({ gameId: game.id, userId });
        if (valid) accessibleGames.push(game);
    }

    if (!accessibleGames.length) {
        return {
            content: '⚠️ You have no accessible games in this server.',
            ephemeral: true,
        };
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder('Choose your game')
        .addOptions(
            accessibleGames.map(g => ({
                label: g.name.slice(0, 100),
                description: g.description?.slice(0, 90) || 'No description.',
                value: g.id,
            }))
        );

    const row = new ActionRowBuilder().addComponents(menu);

    return {
        content: '🎲 Choose your active game:',
        components: [row],
        ephemeral: true,
    };
}

/**
 * Handles selection from the switchGameDropdown
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { user, guildId, values } = interaction;
    const selected = values?.[0];

    if (!guildId) {
        return interaction.reply({
            content: '⚠️ This action must be used in a server.',
            ephemeral: true,
        });
    }

    if (!selected) {
        return interaction.reply({
            content: '⚠️ No game selected.',
            ephemeral: true,
        });
    }

    try {
        await getOrCreatePlayer(user.id, guildId);
        await setCurrentGame(user.id, guildId, selected);

        return interaction.update({
            content: `✅ You have switched to the selected game.`,
            components: [],
        });
    } catch (err) {
        console.error('Error switching game:', err);
        return interaction.reply({
            content: '❌ Failed to switch game.',
            ephemeral: true,
        });
    }
}

module.exports = {
    id,
    build,
    handle,
};
