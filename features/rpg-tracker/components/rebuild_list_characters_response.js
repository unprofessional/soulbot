// features/rpg-tracker/components/rebuild_list_characters_response.js

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { getCurrentCharacter } = require('../../../store/services/player.service');
const { formatTimeAgo } = require('../utils/time_ago');

const { build: buildCharacterSelector } = require('./public_character_selector');
const { build: buildPaginationButtons } = require('./character_page_buttons');

async function rebuildListCharactersResponse(characters, page = 0, userId, guildId) {
    const PAGE_SIZE = 25;
    const currentCharacterId = await getCurrentCharacter(userId, guildId);

    const hydrated = [];

    for (const char of characters) {
        try {
            const full = await getCharacterWithStats(char.id);
            if (!full) continue;

            const isActive = full.id === currentCharacterId;
            const baseLabel = `${full.name} — ${formatTimeAgo(full.created_at)}`;
            const label = isActive ? `⭐ ${baseLabel} (ACTIVE)` : baseLabel;

            const topStats = (full.stats || [])
                .slice()
                .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.label.localeCompare(b.label))
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

            hydrated.push({
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
    hydrated.sort((a, b) => Number(b.isActive) - Number(a.isActive));

    const totalPages = Math.ceil(hydrated.length / PAGE_SIZE);
    const pageSlice = hydrated.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const components = [
        buildCharacterSelector(page, pageSlice),
    ];

    if (hydrated.length > PAGE_SIZE) {
        components.push(buildPaginationButtons(page, page > 0, (page + 1) * PAGE_SIZE < hydrated.length));
    }

    return {
        content: `📖 **Public Characters in Your Game** (Page ${page + 1}/${totalPages})`,
        components,
    };
}

module.exports = { rebuildListCharactersResponse };
