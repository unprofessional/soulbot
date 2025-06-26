// features/rpg-tracker/select_menu_handlers/index.js

const characterDropdown = require('./character_dropdown');
const gameDropdown = require('./game_dropdown');
const statDropdown = require('./stat_template_dropdown');

module.exports = {
    async handleSelectMenu(interaction) {
        const { customId } = interaction;

        if (customId === 'createCharacterDropdown' || customId === 'switchCharacterDropdown') {
            return characterDropdown.handle(interaction);
        }

        if (customId === 'joinGameDropdown' || customId === 'switchGameDropdown') {
            return gameDropdown.handle(interaction);
        }

        if (customId.startsWith('editStatSelect:')) {
            return statDropdown.handle(interaction);
        }

        return interaction.reply({
            content: '❌ Unknown menu selection.',
            ephemeral: true,
        });
    },
};
