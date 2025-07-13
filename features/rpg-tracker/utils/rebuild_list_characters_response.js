// features/rpg-tracker/utils/rebuild_list_characters_response.js

const {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { getCurrentCharacter } = require('../../../store/services/player.service');
const { formatTimeAgo } = require('./time_ago');

/**
 * Builds a paginated list of public characters, with active character highlighted and sorted first.
 * @param {Array} characters - List of character stubs (at minimum: id, name)
 * @param {number} page
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<{ content: string, components: ActionRowBuilder[] }>}
 */
async function rebuildListCharactersResponse(characters, page = 0, userId, guildId) {
    const PAGE_SIZE = 25;
    const currentCharacterId = await getCurrentCharacter(userId, guildId);
    const hydratedCharacters = [];

    for (const char of characters) {
        try {
            const full = await getCharacterWithStats(char.id);
            if (!full) continue;

            const isActive = full.id === currentCharacterId;

            const baseLabel = `${full.name} — ${formatTimeAgo(full.created_at)}`;
            const label = isActive ? `⭐ ${baseLabel} (it's you)` : baseLabel;

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

            hydratedCharacters.push({
                id: full.id,
                label: label.slice(0, 100),
                description: description.slice(0, 100),
                isActive,
            });
        } catch (err) {
            console.error(`❌ Failed to hydrate or format character ${char.name} (${char.id}):`, err);
        }
    }

    // Sort so active character is first
    hydratedCharacters.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });

    const totalPages = Math.ceil(hydratedCharacters.length / PAGE_SIZE);
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageSlice = hydratedCharacters.slice(start, end);

    const hydratedOptions = pageSlice.map(char =>
        new StringSelectMenuOptionBuilder()
            .setLabel(char.label)
            .setDescription(char.description)
            .setValue(char.id)
    );

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

    if (end < hydratedCharacters.length) {
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
