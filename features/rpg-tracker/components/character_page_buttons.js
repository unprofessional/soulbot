// features/rpg-tracker/components/character_page_buttons.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCharactersByGame } = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const { rebuildListCharactersResponse } = require('./rebuild_list_characters_response');

const id = 'charPage';

/**
 * Builds pagination buttons for character list.
 */
function build(page, hasPrev, hasNext) {
    const row = new ActionRowBuilder();

    if (hasPrev) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${id}:prev:${page}`)
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (hasNext) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${id}:next:${page}`)
                .setLabel('➡️ Next')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return row;
}

/**
 * Handles button press for next/prev page in public character list.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    try {
        const [prefix, direction, rawPage] = interaction.customId.split(':');
        if (prefix !== id) return;

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

        const { content, components } = await rebuildListCharactersResponse(publicChars, nextPage, userId, guildId);

        await interaction.update({ content, components });

    } catch (err) {
        console.error('[BUTTON ERROR] character_page_buttons:', err);
        await interaction.reply({
            content: '❌ Failed to change page.',
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
