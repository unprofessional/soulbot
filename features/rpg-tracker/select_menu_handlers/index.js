// features/rpg-tracker/select_menu_handlers/index.js

const characterDropdown = require('./character_dropdown');
const gameDropdown = require('./game_dropdown');
const statDropdown = require('./stat_template_dropdown');
const characterStatSelect = require('./character_stat_select_menu');
const statTypeDropodown = require('./stat_type_select');
const adjustNumericStatSelectHandler = require('./adjust_numeric_stat_select');
const publicCharacterSelect = require('./public_character_select');

module.exports = {
    async handleSelectMenu(interaction) {
        const { customId } = interaction;

        if (
            customId === 'createCharacterDropdown' ||
            customId === 'switchCharacterDropdown' ||
            customId === 'editCharacterFieldDropdown'

        ) {
            return characterDropdown.handle(interaction);
        }

        if (
            customId === 'joinGameDropdown' ||
            customId === 'switchGameDropdown'
        ) {
            return gameDropdown.handle(interaction);
        }

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
            customId.statTypeDropodown('selectPublicCharacter:')
        ) {
            return publicCharacterSelect.handle(interaction);
        }

        return interaction.reply({
            content: '❌ Unknown menu selection.',
            ephemeral: true,
        });
    },
};
