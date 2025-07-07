// features/rpg-tracker/button_handlers/public_character_pagination.js

const { getCharactersByGame } = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const { rebuildListCharactersResponse } = require('../utils/rebuild_list_characters_response');

/**
 * Handles pagination buttons (prev/next) in /list-characters
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    try {
        const [prefix, direction, rawPage] = interaction.customId.split(':'); // charPage:next:0
        if (prefix !== 'charPage') return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const gameId = await getCurrentGame(userId, guildId);

        if (!gameId) {
            return await interaction.reply({
                content: '❌ You are not in an active game.',
                ephemeral: true,
            });
        }

        const characters = await getCharactersByGame(gameId);
        const publicChars = characters.filter(c => c.visibility === 'public');

        const currentPage = parseInt(rawPage, 10) || 0;
        const nextPage = direction === 'next' ? currentPage + 1 : Math.max(0, currentPage - 1);

        const { content, components } = rebuildListCharactersResponse(publicChars, nextPage);

        await interaction.update({
            content,
            components,
        });

    } catch (err) {
        console.error('[BUTTON ERROR] public_character_pagination:', err);
        await interaction.reply({
            content: '❌ Failed to change page.',
            ephemeral: true,
        });
    }
}

module.exports = { handle };
