// features/rpg-tracker/modal_handlers/index.js

const gameModals = require('./game_modals');
const statTemplateModals = require('./stat_template_modals');
const characterCreationModals = require('./character_creation_modals');
const characterEditModals = require('./character_edit_modals');
const inventoryModals = require('./inventory_modals');

module.exports = {
    async handleModal(interaction) {
        const { customId } = interaction;

        if (customId.startsWith('editGameModal:')) return gameModals.handle(interaction);
        if (customId.startsWith('createStatTemplate:') || customId.startsWith('editStatTemplateModal:')) return statTemplateModals.handle(interaction);
        if (customId.startsWith('createCharacterModal:') || customId.startsWith('setCharacterField:')) return characterCreationModals.handle(interaction);
        if (
            customId.startsWith('editCharacterModal:') ||
  customId.startsWith('editStatModal:') ||
  customId.startsWith('setCharacterField:')
        ) {
            return characterEditModals.handle(interaction);
        }
        if (customId.startsWith('addInventoryModal:')) return inventoryModals.handle(interaction);

        return interaction.reply({ content: '❓ Unknown modal submission.', ephemeral: true });
    },
};
