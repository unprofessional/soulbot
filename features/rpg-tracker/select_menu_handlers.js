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
const { getStatTemplates } = require('../../store/services/game.service');

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
            try {
                const [, gameId] = customId.split(':');
                const statTemplates = await getStatTemplates(gameId);
                const field = statTemplates.find(f => f.id === selected);

                if (!field) {
                    return await interaction.reply({
                        content: '❌ Could not find that stat field.',
                        ephemeral: true,
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`editStatTemplateModal:${field.id}`)
                    .setTitle('Edit Required Stat Field')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('label')
                                .setLabel('Field Label')
                                .setStyle(TextInputStyle.Short)
                                .setValue(field.label)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('default_value')
                                .setLabel('Default Value')
                                .setStyle(TextInputStyle.Short)
                                .setValue(field.default_value || '')
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('field_type')
                                .setLabel('Field Type ("short" or "paragraph")')
                                .setStyle(TextInputStyle.Short)
                                .setValue(field.field_type)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('sort_order')
                                .setLabel('Sort Order')
                                .setStyle(TextInputStyle.Short)
                                .setValue(field.sort_order?.toString() || '0')
                                .setRequired(false)
                        )
                    );

                return await interaction.showModal(modal);
            } catch (err) {
                console.error('Error selecting stat field to edit:', err);
                return await interaction.reply({
                    content: '❌ Failed to show edit modal.',
                    ephemeral: true,
                });
            }
        }

    },
};
