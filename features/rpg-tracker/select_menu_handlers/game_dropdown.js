// features/rpg-tracker/select_menu_handlers/game_dropdown.js

const {
    getOrCreatePlayer,
    setCurrentGame,
} = require('../../../store/services/player.service');

/**
 * Handles game selection dropdowns (join or switch game).
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, user, guildId, values } = interaction;
    const selected = values?.[0];

    if (!guildId) {
        return await interaction.reply({
            content: '⚠️ This command must be used in a server.',
            ephemeral: true,
        });
    }

    if (!selected) {
        return await interaction.reply({
            content: '⚠️ No game selected.',
            ephemeral: true,
        });
    }

    if (customId === 'joinGameDropdown' || customId === 'switchGameDropdown') {
        try {
            // Ensure player exists in this server
            await getOrCreatePlayer(user.id, guildId);

            // Set selected game as current
            await setCurrentGame(user.id, guildId, selected);

            const verb = customId === 'joinGameDropdown' ? 'joined' : 'switched to';

            return await interaction.update({
                content: `✅ You have ${verb} the selected game.`,
                components: [],
            });
        } catch (err) {
            console.error('Error joining or switching game:', err);
            return await interaction.reply({
                content: '❌ Failed to join or switch game.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
