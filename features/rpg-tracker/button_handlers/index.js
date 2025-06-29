// features/rpg-tracker/button_handlers/index.js

const gameButtons = require('./game_buttons');
const statButtons = require('./stat_template_buttons');
const charCreateButtons = require('./character_creation_buttons');
const charEditButtons = require('./character_edit_buttons');
const toggleVisibilityButton = require('./toggle_visibility');
const inventoryButtons = require('./inventory_buttons');
const fallbackButtons = require('./fallback_buttons');

module.exports = {
    async handleButton(interaction) {
        const { customId } = interaction;

        if (
            customId.startsWith('editGameModal:') ||
            customId.startsWith('publishGame:') ||
            customId.startsWith('togglePublishGame:')
        ) {
            return gameButtons.handle(interaction);
        }

        if (
            customId.startsWith('defineStats:') ||
            customId.startsWith('editStats:') ||
            customId.startsWith('edit_stat_template:') ||
            customId.startsWith('finishStatSetup:')
        ) {
            return statButtons.handle(interaction);
        }

        if (customId === 'submitNewCharacter') {
            return charCreateButtons.handle(interaction);
        }

        if (customId.startsWith('edit_stat:')) {
            return charEditButtons.handle(interaction);
        }

        if (customId.startsWith('toggle_visibility:')) {
            return toggleVisibilityButton.handle(interaction);
        }

        if (
            customId.startsWith('add_inventory_item:') ||
            customId.startsWith('view_inventory:') ||
            customId.startsWith('clear_inventory:') ||
            customId.startsWith('confirm_clear_inventory:') ||
            customId === 'cancel_clear_inventory'
        ) {
            return inventoryButtons.handle(interaction);
        }

        return fallbackButtons.handle(interaction);
    },

    async execute(interaction) {
        return fallbackButtons.execute(interaction);
    }
};
