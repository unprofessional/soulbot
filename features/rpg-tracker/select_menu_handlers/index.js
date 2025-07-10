// features/rpg-tracker/select_menu_handlers/index.js

const characterDropdown = require('./character_dropdown');
const characterStatSelect = require('./character_stat_select_menu');
const adjustNumericStatSelectHandler = require('./adjust_numeric_stat_select');
const publicCharacterSelect = require('./public_character_select');
const { handle: handleSwitchCharacterSelector } = require('../components/switch_character_selector');
const { handle: handleSwitchGameSelector } = require('../components/switch_game_selector');
const { handle: handleJoinGameSelector } = require('../components/join_game_selector');
const { handle: editStatSelectorHandler } = require('../components/edit_stat_selector');
const { handle: deleteStatSelectorHandler } = require('../components/delete_stat_selector');
const { handle: statTypeSelectorHandler } = require('../components/stat_type_selector');

module.exports = {
    async handleSelectMenu(interaction) {
        const { customId } = interaction;

        if (customId === 'switchCharacterDropdown') return handleSwitchCharacterSelector(interaction);
        if (customId === 'switchGameDropdown') return handleSwitchGameSelector(interaction);
        if (customId === 'joinGameDropdown') return handleJoinGameSelector(interaction);
        if (customId.startsWith('editStatSelect:')) return editStatSelectorHandler(interaction);
        if (customId.startsWith('deleteStatSelect:')) return deleteStatSelectorHandler(interaction);
        if (customId.startsWith('selectStatType:')) return statTypeSelectorHandler(interaction);

        if (
            customId === 'createCharacterDropdown' ||
            customId === 'editCharacterFieldDropdown'
        ) {
            return characterDropdown.handle(interaction);
        }

        if (customId.startsWith('editCharacterStatDropdown:')) {
            return characterStatSelect.handle(interaction);
        }

        if (customId.startsWith('adjustStatSelect:')) {
            return adjustNumericStatSelectHandler.handle(interaction);
        }

        if (customId.startsWith('selectPublicCharacter:')) {
            return publicCharacterSelect.handle(interaction);
        }

        return interaction.reply({
            content: '❌ Unknown menu selection.',
            ephemeral: true,
        });
    },
};
