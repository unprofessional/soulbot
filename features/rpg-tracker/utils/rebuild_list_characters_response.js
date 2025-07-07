// features/rpg-tracker/utils/rebuild_list_characters_response.js

const {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { formatTimeAgo } = require('./time_ago');

/**
 * Builds a paginated dropdown UI for public characters in a game.
 * @param {Array<Object>} characters - Public character rows (unhydrated)
 * @param {number} page - Zero-based page index
 * @returns {{ content: string, components: ActionRowBuilder[] }}
 */
async function rebuildListCharactersResponse(characters, page = 0) {
    const PAGE_SIZE = 25;
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const totalPages = Math.ceil(characters.length / PAGE_SIZE);

    const slice = characters.slice(start, end);

    const hydratedOptions = [];

    for (const char of slice) {
        const full = await getCharacterWithStats(char.id);

        const label = `${full.name} — ${formatTimeAgo(full.created_at)}`.slice(0, 100);

        const topStats = (full.stats || [])
            .slice()
            .sort((a, b) => {
                if ((a.sort_order ?? 999) !== (b.sort_order ?? 999)) {
                    return (a.sort_order ?? 999) - (b.sort_order ?? 999);
                }
                return a.label.localeCompare(b.label);
            })
            .slice(0, 4)
            .map(stat => {
                if (stat.field_type === 'count') {
                    const current = stat.meta?.current ?? '?';
                    const max = stat.meta?.max ?? '?';
                    return `${stat.label}: ${current} / ${max}`;
                } else {
                    return `${stat.label}: ${stat.value}`;
                }
            });

        const description = topStats.join(' • ') || (full.bio || 'No stats available');

        hydratedOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setDescription(description.slice(0, 100))
                .setValue(full.id)
        );
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`selectPublicCharacter:${page}`)
        .setPlaceholder('Select a character to view...')
        .addOptions(hydratedOptions);

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
