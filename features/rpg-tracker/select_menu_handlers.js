// features/rpg-tracker/select_menu_handlers.js

const {
    setCurrentCharacter,
    setCurrentGame,
    getOrCreatePlayer,
} = require('../../store/services/player.service');
const {
    getCharacterWithStats,
} = require('../../store/services/character.service');
const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('./embed_utils');

module.exports = {
    /**
     * Handles select menu interactions like character switching or joining games.
     * @param {import('discord.js').StringSelectMenuInteraction} interaction
     */
    async handleSelectMenu(interaction) {
        const { customId, user, values } = interaction;

        // === /switch-character dropdown ===
        if (customId === 'switchCharacterDropdown') {
            const selectedId = values?.[0];
            if (!selectedId) {
                return await interaction.reply({
                    content: '⚠️ No character selected.',
                    ephemeral: true,
                });
            }

            try {
                await setCurrentCharacter(user.id, selectedId);
                const character = await getCharacterWithStats(selectedId);

                return await interaction.update({
                    content: `✅ Switched to **${character.name}**!`,
                    embeds: [buildCharacterEmbed(character)],
                    components: [buildCharacterActionRow(character.id)],
                });
            } catch (err) {
                console.error('Error switching character:', err);
                return await interaction.reply({
                    content: '❌ Failed to switch character.',
                    ephemeral: true,
                });
            }
        }

        // === /join-game dropdown ===
        if (customId === 'joinGameDropdown') {
            const selectedGameId = values?.[0];
            if (!selectedGameId) {
                return await interaction.reply({
                    content: '⚠️ No game selected.',
                    ephemeral: true,
                });
            }

            try {
                await getOrCreatePlayer(user.id); // ensure exists
                await setCurrentGame(user.id, selectedGameId);

                return await interaction.update({
                    content: `✅ You have joined the selected game.`,
                    components: [],
                });
            } catch (err) {
                console.error('Error joining game:', err);
                return await interaction.reply({
                    content: '❌ Failed to join game.',
                    ephemeral: true,
                });
            }
        }

        // === /switch-game dropdown ===
        if (customId === 'switchGameDropdown') {
            const selectedGameId = values?.[0];
            if (!selectedGameId) {
                return await interaction.reply({
                    content: '⚠️ No game selected.',
                    ephemeral: true,
                });
            }

            try {
                await getOrCreatePlayer(user.id); // ensure player row exists
                await setCurrentGame(user.id, selectedGameId);

                return await interaction.update({
                    content: `✅ Switched to selected game.`,
                    components: [],
                });
            } catch (err) {
                console.error('Error switching game:', err);
                return await interaction.reply({
                    content: '❌ Failed to switch game.',
                    ephemeral: true,
                });
            }
        }

    },
};
