// features/rpg-tracker/select_menu_handlers/index.js

const characterDropdown = require('./character_dropdown');
const gameDropdown = require('./game_dropdown');
const statDropdown = require('./stat_template_dropdown');
const characterStatSelect = require('./character_stat_select_menu');
const statTypeDropodown = require('./stat_type_select');
const adjustNumericStatSelectHandler = require('./adjust_numeric_stat_select');
const publicCharacterSelect = require('./public_character_select');
const { handle : handleSwitchCharacterSelector } = require('../components/switch_character_selector');
const { handle: handleSwitchGameSelector } = require('../components/switch_game_selector');

module.exports = {
    async handleSelectMenu(interaction) {
        const { customId } = interaction;

        if (
            customId === 'createCharacterDropdown' ||
            customId === 'editCharacterFieldDropdown'
        ) {
            return characterDropdown.handle(interaction);
        }

        if (customId === 'switchCharacterDropdown') return handleSwitchCharacterSelector(interaction);

        if (customId === 'switchGameDropdown') return handleSwitchGameSelector(interaction);

        // legacy support
        if (customId === 'joinGameDropdown') return gameDropdown.handle(interaction);

        if (
            customId.startsWith('editStatSelect:') ||
            customId.startsWith('deleteStatSelect:')
        ) {
            return statDropdown.handle(interaction);
        }

        if (customId.startsWith('editCharacterStatDropdown:')) {
            return characterStatSelect.handle(interaction);
        }

        if (customId.startsWith('selectStatType:')) {
            return statTypeDropodown.handle(interaction);
        }

        if (
            customId.startsWith('adjustStatSelect:')
        ) {
            return adjustNumericStatSelectHandler.handle(interaction);
        }

        if (
            customId.startsWith('selectPublicCharacter:')
        ) {
            return publicCharacterSelect.handle(interaction);
        }

        return interaction.reply({
            content: '❌ Unknown menu selection.',
            ephemeral: true,
        });
    },
};
