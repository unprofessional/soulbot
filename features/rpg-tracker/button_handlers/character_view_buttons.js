// features/rpg-tracker/button_handlers/character_view_buttons.js

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { renderCharacterView } = require('../utils/render_character_view');

async function handle(interaction) {
    const { customId } = interaction;

    if (customId.startsWith('goBackToCharacter:')) {
        const [, characterId] = customId.split(':');

        const character = await getCharacterWithStats(characterId);
        if (!character) {
            return await interaction.update({
                content: '❌ Character not found.',
                embeds: [],
                components: [],
            });
        }

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const view = await renderCharacterView(character, { userId, guildId });
        return await interaction.update(view);
    }
}


module.exports = { handle };
