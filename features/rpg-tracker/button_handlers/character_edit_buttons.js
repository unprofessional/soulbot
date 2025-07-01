// ✅ File: features/rpg-tracker/button_handlers/character_edit_buttons.js

const {
    getCharacterWithStats,
} = require('../../../store/services/character.service');
const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { getTempCharacterData } = require('../../../store/services/character_draft.service');
const { rebuildCreateCharacterResponse } = require('../utils/rebuild_create_character_response');

module.exports = {
    async handle(interaction) {
        const { customId, user, guild } = interaction;

        // === 🎲 Edit Stat Button Pressed ===
        if (customId.startsWith('edit_stat:')) {
            const [, characterId] = customId.split(':');

            const character = await getCharacterWithStats(characterId);
            const game = await getGame({ id: character.game_id });
            const statTemplates = await getStatTemplates(game.id);
            const draftData = await getTempCharacterData(user.id, guild.id, game.id);

            const userFields = []; // future use for custom fields
            const fieldOptions = []; // skip required-field flow

            const response = rebuildCreateCharacterResponse(
                game,
                statTemplates,
                userFields,
                fieldOptions,
                draftData
            );

            return await interaction.update(response);
        }
    }
};
