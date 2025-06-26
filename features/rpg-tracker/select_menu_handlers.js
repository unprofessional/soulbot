// features/rpg-tracker/select_menu_handlers.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

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

        if (customId === 'createCharacterDropdown') {
            const selectedField = values?.[0];
            if (!selectedField) {
                return await interaction.reply({
                    content: '⚠️ No field selected.',
                    ephemeral: true,
                });
            }

            let label = selectedField;
            const inputStyle =
                selectedField === 'core:bio'
                    ? TextInputStyle.Paragraph
                    : TextInputStyle.Short;

            const modal = new ModalBuilder()
                .setCustomId(`setCharacterField:${selectedField}`)
                .setTitle(`Enter value for ${label}`)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('value')
                            .setLabel(`Value for ${label}`)
                            .setStyle(inputStyle)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

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
                await getOrCreatePlayer(user.id);
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
                await getOrCreatePlayer(user.id);
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
