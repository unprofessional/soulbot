// features/rpg-tracker/button_handlers/inventory_buttons.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getCharacterWithStats,
} = require('../../store/services/character.service');
const {
    deleteInventoryByCharacter,
} = require('../../store/services/inventory.service');

const {
    buildInventoryEmbed,
    buildInventoryActionRow,
} = require('./embed_utils');

/**
 * Handles inventory-related button interactions.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

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
}

module.exports = { handle };
