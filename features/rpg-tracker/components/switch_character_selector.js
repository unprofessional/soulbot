// features/rpg-tracker/components/switch_character_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getCharactersByGame, getCharacterWithStats } = require('../../../store/services/character.service');
const { getCurrentGame, getCurrentCharacter, setCurrentCharacter } = require('../../../store/services/player.service');
const { validateGameAccess } = require('../validate_game_access');
const { formatTimeAgo } = require('../utils/time_ago');
const { isActiveCharacter } = require('../utils/is_active_character');
const { buildCharacterEmbed, buildCharacterActionRow } = require('../embed_utils');

const id = 'switchCharacterDropdown';

/**
 * Builds a dropdown to switch characters
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<{ content: string, components: ActionRowBuilder[], ephemeral: boolean } | { content: string, ephemeral: boolean }>}
 */
async function build(userId, guildId) {
    const currentGameId = await getCurrentGame(userId, guildId);
    if (!currentGameId) {
        return {
            content: '⚠️ You don\'t have an active game in this server. Use `/switch-game` or `/join-game` first.',
            ephemeral: true,
        };
    }

    const currentCharacterId = await getCurrentCharacter(userId, guildId);
    const allCharacters = await getCharactersByGame(currentGameId);
    const eligibleOptions = [];

    for (const character of allCharacters) {
        const { valid } = await validateGameAccess({
            gameId: character.game_id,
            userId,
        });

        if (!valid) continue;

        const fullCharacter = await getCharacterWithStats(character.id);
        const isActive = fullCharacter.id === currentCharacterId;

        const topStats = (fullCharacter.stats || [])
            .slice()
            .sort((a, b) => {
                if ((a.sort_order ?? 999) !== (b.sort_order ?? 999)) {
                    return (a.sort_order ?? 999) - (b.sort_order ?? 999);
                }
                return a.label.localeCompare(b.label);
            })
            .slice(0, 4)
            .map(s => {
                if (s.field_type === 'count') {
                    const current = s.meta?.current ?? '?';
                    const max = s.meta?.max ?? '?';
                    return `${s.label}: ${current} / ${max}`;
                } else {
                    return `${s.label}: ${s.value}`;
                }
            });

        const visibilityBadge = fullCharacter.visibility === 'public'
            ? '✅ Public'
            : '🔒 Private';

        const baseLabel = `${fullCharacter.name} — ${formatTimeAgo(fullCharacter.created_at)} — ${visibilityBadge}`;
        const label = isActive
            ? `⭐ ${baseLabel} (ACTIVE)`
            : baseLabel;

        eligibleOptions.push({
            label: label.length > 100 ? label.slice(0, 97) + '…' : label,
            description: topStats.join(' • ').slice(0, 100) || 'No stats available',
            value: fullCharacter.id,
            isActive,
        });
    }

    if (!eligibleOptions.length) {
        return {
            content: '⚠️ You have no characters in published or accessible games.',
            ephemeral: true,
        };
    }

    // Sort so active character appears first
    eligibleOptions.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

    const menu = new StringSelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder('Choose your character')
        // eslint-disable-next-line no-unused-vars
        .addOptions(eligibleOptions.map(({ isActive, ...opt }) => opt)); // strip isActive

    const row = new ActionRowBuilder().addComponents(menu);

    return {
        content: '🎭 Choose your active character:',
        components: [row],
        ephemeral: true,
    };
}

/**
 * Handles dropdown interaction
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const selected = interaction.values?.[0];
    const { user, guildId } = interaction;

    if (!selected) {
        return interaction.reply({
            content: '⚠️ No selection made.',
            ephemeral: true,
        });
    }

    try {
        if (!guildId) {
            return interaction.reply({
                content: '⚠️ This action must be used in a server.',
                ephemeral: true,
            });
        }

        await setCurrentCharacter(user.id, guildId, selected);
        const character = await getCharacterWithStats(selected);

        const isSelf = await isActiveCharacter(user.id, guildId, character.id);

        return interaction.update({
            content: `✅ Switched to **${character.name}**!`,
            embeds: [buildCharacterEmbed(character)],
            components: [buildCharacterActionRow(character.id, {
                isSelf,
                visibility: character.visibility,
            })],
        });
    } catch (err) {
        console.error('Error switching character:', err);
        return interaction.reply({
            content: '❌ Failed to switch character.',
            ephemeral: true,
        });
    }
}

module.exports = {
    id,
    build,
    handle,
};
