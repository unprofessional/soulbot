// features/rpg-tracker/components/join_game_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const {
    getGame,
} = require('../../../store/services/game.service');

const {
    getOrCreatePlayer,
    setCurrentGame,
} = require('../../../store/services/player.service');

const id = 'joinGameDropdown';

/**
 * Builds the joinable game dropdown for public games
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<{ content: string, ephemeral: true } | { content: string, components: ActionRowBuilder[], ephemeral: true }>}
 */
async function build(userId, guildId) {
    await getOrCreatePlayer(userId, guildId);

    const games = await getGame({ guildId });

    const eligibleGames = games.filter(game =>
        game.is_public && game.created_by !== userId
    );

    if (!eligibleGames.length) {
        return {
            content: [
                '📭 There are no joinable public games in this server right now.',
                '',
                'If you created a game, you’re already considered a player as the **Game Master**.',
            ].join('\n'),
            ephemeral: true,
        };
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder('Select a game to join')
        .addOptions(
            eligibleGames.slice(0, 25).map(game => ({
                label: game.name.slice(0, 100),
                description: game.description?.slice(0, 100) || 'No description',
                value: game.id,
            }))
        );

    const row = new ActionRowBuilder().addComponents(menu);

    return {
        content: '🎲 Choose a game you want to join:',
        components: [row],
        ephemeral: true,
    };
}

/**
 * Handles game selection from joinGameDropdown
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
            content: `✅ You have joined the selected game.`,
            components: [],
        });
    } catch (err) {
        console.error('Error joining game:', err);
        return interaction.reply({
            content: '❌ Failed to join the selected game.',
            ephemeral: true,
        });
    }
}

module.exports = {
    id,
    build,
    handle,
};
