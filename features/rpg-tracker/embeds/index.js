// features/rpg-tracker/embeds/index.js

const gameStatEmbed = require('./game_stat_embed');

module.exports = {
    async handleSelectMenu(interaction) {
        const { customId } = interaction;

        if (
            customId === 'createCharacterDropdown' ||
            customId === 'switchCharacterDropdown'
        ) { // FIXME: Copied from other file as example, we must use correct names here
            return gameStatEmbed.handle(interaction);
        }

        return interaction.reply({
            content: '❌ Unknown embed.',
            ephemeral: true,
        });
    },
};
