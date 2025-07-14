// features/rpg-tracker/button_handlers/character_view_buttons.js

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { isActiveCharacter } = require('../utils/is_active_character');
const { build: buildCharacterCard } = require('../components/view_character_card');

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
        const isSelf = await isActiveCharacter(userId, guildId, character.id);

        const view = await buildCharacterCard(character, { viewerUserId: isSelf ? userId : null });
        return await interaction.update(view);
    }
}

module.exports = { handle };
