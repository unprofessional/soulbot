// features/rpg-tracker/utils/rebuild_list_characters_response.js

const {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

/**
 * Builds a paginated dropdown UI for public characters in a game.
 * @param {Array<Object>} characters - Public characters
 * @param {number} page - Zero-based page index
 * @returns {{ content: string, components: ActionRowBuilder[] }}
 */
function rebuildListCharactersResponse(characters, page = 0) {
    const PAGE_SIZE = 25;
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const totalPages = Math.ceil(characters.length / PAGE_SIZE);

    const slice = characters.slice(start, end);

    const select = new StringSelectMenuBuilder()
        .setCustomId(`selectPublicCharacter:${page}`)
        .setPlaceholder('Select a character to view...')
        .addOptions(
            slice.map(char =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(char.name.slice(0, 100))
                    .setDescription((char.bio || 'No bio').slice(0, 50))
                    .setValue(char.id)
            )
        );

    const row = new ActionRowBuilder().addComponents(select);

    const buttons = new ActionRowBuilder();

    if (page > 0) {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`charPage:prev:${page}`)
                .setLabel('⬅️ Previous')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (end < characters.length) {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`charPage:next:${page}`)
                .setLabel('➡️ Next')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return {
        content: `📖 **Public Characters in Your Game** (Page ${page + 1}/${totalPages})`,
        components: [row, ...(buttons.components.length ? [buttons] : [])],
    };
}

module.exports = {
    rebuildListCharactersResponse,
};
