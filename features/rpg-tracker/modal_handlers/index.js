// features/rpg-tracker/modal_handlers/index.js

const statTemplateModals = require('./stat_template_modals');
const characterCreationModals = require('./character_creation_modals');
const characterEditModals = require('./character_edit_modals');
const inventoryModals = require('./inventory_modals');
const statCalculatorModal = require('./stat_calculator_modal');
const { handle: handleCreateStatModal } = require('../components/create_stat_modal');

module.exports = {
    async handleModal(interaction) {
        const { customId } = interaction;

        // GAME-related
        if (customId.startsWith('editStatTemplateModal:')) return statTemplateModals.handle(interaction);
        if (customId.startsWith('createStatModal:')) return handleCreateStatModal(interaction);

        // DRAFT Character creation flow
        if (
            customId.startsWith('createCharacterModal:') ||
            customId.startsWith('createDraftCharacterField:')
        ) return characterCreationModals.handle(interaction);

        // EDIT Existing characters
        if (
            customId.startsWith('editCharacterModal:') ||
            customId.startsWith('editStatModal:') ||
            customId.startsWith('setCharacterField:') ||
            customId.startsWith('editCharacterField:')
        ) return characterEditModals.handle(interaction);

        if (customId.startsWith('adjustStatModal:')) return statCalculatorModal.handle(interaction);

        // === Inventory ===
        if (customId.startsWith('addInventoryModal:')) return inventoryModals.handle(interaction);

        return interaction.reply({
            content: '❓ Unknown modal submission.',
            ephemeral: true,
        });
    },
};
