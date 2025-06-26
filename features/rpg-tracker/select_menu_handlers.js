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

        const selected = values?.[0];
        if (!selected) {
            return await interaction.reply({
                content: '⚠️ No selection made.',
                ephemeral: true,
            });
        }

        // === /create-character dropdown ===
        if (customId === 'createCharacterDropdown') {
            const [selectedField, rawLabel] = selected.split('|');
            const label = rawLabel || selectedField; // fallback

            const inputStyle = selectedField === 'core:bio'
                ? TextInputStyle.Paragraph
                : TextInputStyle.Short;

            const modal = new ModalBuilder()
                .setCustomId(`setCharacterField:${selectedField}`)
                .setTitle(`Enter value for ${label}`)
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId(selectedField)
                            .setLabel(`Value for ${label}`)
                            .setStyle(inputStyle)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === /switch-character dropdown ===
        if (customId === 'switchCharacterDropdown') {
            try {
                await setCurrentCharacter(user.id, selected);
                const character = await getCharacterWithStats(selected);

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
        if (customId === 'joinGameDropdown' || customId === 'switchGameDropdown') {
            try {
                await getOrCreatePlayer(user.id);
                await setCurrentGame(user.id, selected);

                return await interaction.update({
                    content: `✅ You have ${customId === 'joinGameDropdown' ? 'joined' : 'switched to'} the selected game.`,
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

        // === Edit Game Stat Template Dropdown ===
        if (customId.startsWith('editStatSelect:')) {
            // const [, gameId] = customId.split(':');

            try {
                return await interaction.reply({
                    content: `🔧 You selected stat field ID: \`${selected}\` for editing.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error selecting stat field to edit:', err);
                return await interaction.reply({
                    content: '❌ Failed to select stat field.',
                    ephemeral: true,
                });
            }
        }
    },
};
