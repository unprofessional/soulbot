// features/rpg-tracker/button_handlers/index.js

const charEditButtons = require('./character_edit_buttons');
const toggleVisibilityButton = require('./toggle_visibility');
const inventoryButtons = require('./inventory_buttons');
const fallbackButtons = require('./fallback_buttons');
const adjustCountButtons = require('./adjust_count_buttons');
const characterViewButtons = require('./character_view_buttons');
const { handle: handleDefineStats } = require('../components/define_stats_button');
const { handle: handleEditStats } = require('../components/edit_stat_button');
const { handle: handleDeleteStats } = require('../components/delete_stat_button');
const { handle: handleFinishStatSetup } = require('../components/finish_stat_setup_button');
const { handle: handleTogglePublishButton} = require('../components/toggle_publish_button');
const { handle: handleConfirmDeleteStat } = require('../components/confirm_delete_stat_button');
const { handle: handleSubmitCharacter } = require('../components/submit_character_button');
const { handle: handleDeleteCharacter } = require('../components/delete_character_button');
const { handle: handleConfirmDeleteCharacter } = require('../components/confirm_delete_character_button');
const { handle: handleCharPage } = require('../components/character_page_buttons');

module.exports = {
    async handleButton(interaction) {
        const { customId } = interaction;

        /**
         * TODO: Replace all these strings with `id` references from each respective module
         */
        if (customId.startsWith('defineStats:')) return handleDefineStats(interaction);
        if (customId.startsWith('editStats:')) return handleEditStats(interaction);
        if (customId.startsWith('deleteStats:')) return handleDeleteStats(interaction);
        if (customId.startsWith('finishStatSetup:')) return handleFinishStatSetup(interaction);
        if (customId.startsWith('togglePublishGame:')) return handleTogglePublishButton(interaction);
        if (customId.startsWith('confirmDeleteStat:')) return handleConfirmDeleteStat(interaction);
        if (customId.startsWith('submitNewCharacter')) return handleSubmitCharacter(interaction);
        if (customId.startsWith('deleteCharacter')) return handleDeleteCharacter(interaction);
        if (customId.startsWith('confirmDeleteCharacter')) return handleConfirmDeleteCharacter(interaction);
        if (customId.startsWith('charPage:')) return handleCharPage(interaction);

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

        if (
            customId.startsWith('adjust_stats:') ||
            customId.startsWith('decrementCount:') ||
            customId.startsWith('incrementCount:')
        ) {
            return adjustCountButtons.handle(interaction);
        }

        if (customId.startsWith('goBackToCharacter:')) {
            return characterViewButtons.handle(interaction);
        }

        return fallbackButtons.handle(interaction);
    },

    async execute(interaction) {
        return fallbackButtons.execute(interaction);
    }
};
