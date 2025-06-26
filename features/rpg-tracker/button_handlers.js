const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getCharactersByUser,
    getCharacterWithStats,
} = require('../../store/services/character.service');

const {
    deleteInventoryByCharacter,
} = require('../../store/services/inventory.service');

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
    buildInventoryEmbed,
    buildInventoryActionRow,
} = require('./embed_utils');

const {
    getOrCreatePlayer,
} = require('../../store/services/player.service');

const {
    publishGame,
    getStatTemplates,
} = require('../../store/services/game.service');

const {
    getTempCharacterData,
    finalizeCharacterCreation,
    isDraftComplete,
} = require('../../store/services/character_draft.service');

module.exports = {
    /**
     * Handles direct button interaction events.
     * @param {import('discord.js').ButtonInteraction} interaction
     */
    async handleButton(interaction) {
        const { customId, user } = interaction;

        // === Edit Game Modal ===
        if (customId.startsWith('editGameModal:')) {
            const [, gameId] = customId.split(':');

            const modal = new ModalBuilder()
                .setCustomId(`editGameModal:${gameId}`)
                .setTitle('Edit Game Details')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel('Game Name')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('description')
                            .setLabel('Game Description')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === Define Required Stats Modal ===
        if (customId.startsWith('defineStats:')) {
            const [, gameId] = customId.split(':');

            const modal = new ModalBuilder()
                .setCustomId(`createStatTemplate:${gameId}`)
                .setTitle('Add Required Stat Field')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('label')
                            .setLabel('Field Label (e.g. HP, Class, Strength)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('default_value')
                            .setLabel('Default Value (optional)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_type')
                            .setLabel('Field Type ("short" or "paragraph")')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('sort_order')
                            .setLabel('Sort Order (e.g. 0 = top, 100 = bottom)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === Edit Stat Template Modal ===
        if (customId.startsWith('edit_stat_template:')) {
            const [, statFieldId] = customId.split(':');

            // You could optionally fetch existing data for this stat ID if needed
            const statTemplates = await getStatTemplates();
            const currentField = statTemplates.find(f => f.id === statFieldId);

            if (!currentField) {
                return await interaction.reply({
                    content: '❌ Could not find stat template to edit.',
                    ephemeral: true,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`editStatTemplateModal:${statFieldId}`)
                .setTitle('Edit Required Stat Field')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('label')
                            .setLabel('Field Label')
                            .setStyle(TextInputStyle.Short)
                            .setValue(currentField.label)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('default_value')
                            .setLabel('Default Value')
                            .setStyle(TextInputStyle.Short)
                            .setValue(currentField.default_value || '')
                            .setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('field_type')
                            .setLabel('Field Type ("short" or "paragraph")')
                            .setStyle(TextInputStyle.Short)
                            .setValue(currentField.field_type)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === Finish Stat Setup ===
        if (customId.startsWith('finishStatSetup:')) {
            return await interaction.reply({
                content: '🎯 Stat template setup complete! You can now invite players to join and create characters.',
                ephemeral: true,
            });
        }

        // === Publish Game ===
        if (customId.startsWith('publishGame:')) {
            const [, gameId] = customId.split(':');
            try {
                const player = await getOrCreatePlayer(interaction.user.id);

                if (player?.role !== 'gm' || player.current_game_id !== gameId) {
                    return interaction.reply({
                        content: '⚠️ Only the GM of this game can publish it.',
                        ephemeral: true,
                    });
                }

                const result = await publishGame(gameId);

                return interaction.reply({
                    content: `📣 Game **${result.name}** is now published! Players can now see and join it using \`/join-game\`.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error publishing game:', err);
                return interaction.reply({
                    content: '❌ Failed to publish game. Please try again later.',
                    ephemeral: true,
                });
            }
        }

        // === Submit Character ===
        if (customId === 'submitNewCharacter') {
            try {
                const userId = user.id;

                const complete = await isDraftComplete(userId);
                if (!complete) {
                    return await interaction.reply({
                        content: '⚠️ Your character is missing required fields. Please finish filling them out.',
                        ephemeral: true,
                    });
                }

                const draft = await getTempCharacterData(userId);
                const character = await finalizeCharacterCreation(userId, draft);

                return await interaction.update({
                    content: `✅ Character **${character.name}** created successfully!`,
                    embeds: [buildCharacterEmbed(character)],
                    components: [buildCharacterActionRow(character.id)],
                });
            } catch (err) {
                console.error('Error submitting character:', err);
                return await interaction.reply({
                    content: '❌ Failed to submit character. Please try again.',
                    ephemeral: true,
                });
            }
        }

        // === Edit Stat Modal ===
        if (customId.startsWith('edit_stat:')) {
            const characterId = customId.split(':')[1];

            const modal = new ModalBuilder()
                .setCustomId(`editStatModal:${characterId}`)
                .setTitle('Edit Character Stat')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('statName')
                            .setLabel('Stat Name (e.g., hp, vigor, ranged)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('statValue')
                            .setLabel('New Stat Value (integer)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === Add Inventory Modal ===
        if (customId.startsWith('add_inventory_item:')) {
            const [, characterId] = customId.split(':');

            const modal = new ModalBuilder()
                .setCustomId(`addInventoryModal:${characterId}`)
                .setTitle('Add Inventory Item')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel('Item Name')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('type')
                            .setLabel('Item Type (optional)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('description')
                            .setLabel('Description (optional)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === View Inventory ===
        if (customId.startsWith('view_inventory:')) {
            const [, characterId] = customId.split(':');
            try {
                const character = await getCharacterWithStats(characterId);

                return await interaction.reply({
                    embeds: [buildInventoryEmbed(character)],
                    components: [buildInventoryActionRow(character.id)],
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error viewing inventory:', err);
                return await interaction.reply({
                    content: '❌ Failed to load inventory.',
                    ephemeral: true,
                });
            }
        }

        // === Clear Inventory Confirm Prompt ===
        if (customId.startsWith('clear_inventory:')) {
            const [, characterId] = customId.split(':');

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_clear_inventory:${characterId}`)
                    .setLabel('Yes, Delete All Items')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_clear_inventory')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            return await interaction.reply({
                content: '⚠️ Are you sure you want to delete all inventory items for this character?',
                components: [confirmRow],
                ephemeral: true,
            });
        }

        // === Confirm Clear Inventory ===
        if (customId.startsWith('confirm_clear_inventory:')) {
            const [, characterId] = customId.split(':');

            try {
                await deleteInventoryByCharacter(characterId);
                return await interaction.update({
                    content: '🗑️ Inventory cleared.',
                    components: [],
                });
            } catch (err) {
                console.error('Error clearing inventory:', err);
                return await interaction.update({
                    content: '❌ Failed to clear inventory.',
                    components: [],
                });
            }
        }

        // === Cancel Clear Inventory ===
        if (customId === 'cancel_clear_inventory') {
            return await interaction.update({
                content: '❎ Inventory deletion cancelled.',
                components: [],
            });
        }

        // === Fallback ===
        return await interaction.reply({
            content: '❌ Unrecognized button interaction.',
            ephemeral: true,
        });
    },

    /**
     * Compatibility fallback: shows character view via command usage
     */
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        try {
            const allCharacters = await getCharactersByUser(userId, guildId);
            const character = allCharacters.find(c => c.guild_id === guildId) || allCharacters[0];

            if (!character) {
                return await interaction.reply({
                    content: '⚠️ No character found. Use `/create-character` to start one.',
                    ephemeral: true,
                });
            }

            const full = await getCharacterWithStats(character.id);
            return await interaction.reply({
                embeds: [buildCharacterEmbed(full)],
                components: [buildCharacterActionRow(character.id)],
                ephemeral: true,
            });
        } catch (err) {
            console.error('[BUTTON HANDLER ERROR]:', err);
            return await interaction.reply({
                content: '❌ Failed to load character view.',
                ephemeral: true,
            });
        }
    },
};
