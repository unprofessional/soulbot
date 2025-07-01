// features/rpg-tracker/modal_handlers/index.js

const gameModals = require('./game_modals');
const statTemplateModals = require('./stat_template_modals');
const characterCreationModals = require('./character_creation_modals');
const characterEditModals = require('./character_edit_modals');
const inventoryModals = require('./inventory_modals');

module.exports = {
    async handleModal(interaction) {
        const { customId } = interaction;

        // === Game creation/edit modals ===
        if (customId.startsWith('editGameModal:')) return gameModals.handle(interaction);
        if (customId.startsWith('createStatTemplate:') || customId.startsWith('editStatTemplateModal:')) return statTemplateModals.handle(interaction);

        // === Character creation (DRAFT flow) ===
        if (
            customId.startsWith('createCharacterModal:') || // legacy full modal
            customId.startsWith('createDraftCharacterField:') // new single-field modal
        ) {
            return characterCreationModals.handle(interaction);
        }

        // === Character editing (PERSISTED flow) ===
        if (
            customId.startsWith('editCharacterModal:') ||
            customId.startsWith('editStatModal:') ||
            customId.startsWith('setCharacterField:') ||
            customId.startsWith('editCharacterField:')
        ) {
            return characterEditModals.handle(interaction);
        }

        // === Inventory modals ===
        if (customId.startsWith('addInventoryModal:')) return inventoryModals.handle(interaction);

        // === Fallback ===
        return interaction.reply({
            content: '❓ Unknown modal submission.',
            ephemeral: true,
        });
    },
};
