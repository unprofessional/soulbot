// features/rpg-tracker/modal_handlers/inventory_modals.js

const { createItem } = require('../../../store/services/inventory.service');

/**
 * Handles modals related to inventory item creation.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    if (customId.startsWith('addInventoryModal:')) {
        const [, characterId] = customId.split(':');

        try {
            const name = interaction.fields.getTextInputValue('name')?.trim();
            const type = interaction.fields.getTextInputValue('type')?.trim() || null;
            const description = interaction.fields.getTextInputValue('description')?.trim() || null;

            if (!name || name.length > 100) {
                return interaction.reply({
                    content: '⚠️ Invalid item name.',
                    ephemeral: true,
                });
            }

            const item = await createItem(characterId, {
                name,
                type,
                description,
                equipped: false,
            });

            return interaction.reply({
                content: `✅ Added **${item.name}** to inventory.`,
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in addInventoryModal:', err);
            return interaction.reply({
                content: '❌ Failed to add inventory item.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
