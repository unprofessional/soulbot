// features/rpg-tracker/components/view_character_card.js

const { EmbedBuilder, ActionRowBuilder } = require('discord.js');

const { build: buildEditCharacterStatsButton } = require('./edit_character_stats_button');
const { build: buildToggleCharacterVisibilityButton } = require('./toggle_character_visibility_button');
const { build: buildDeleteCharacterButton } = require('./delete_character_button');
const { build: buildCalculateStatsButton } = require('./calculate_character_stats_button');
const { build: buildViewParagraphFieldsButton } = require('./view_paragraph_fields_button');

const { formatTimeAgo } = require('../utils/time_ago');

/**
 * Returns a fully structured character view card (embed + action row).
 */
function build(character, isSelf = false) {

    console.log('🧪 view_character_card.build > isSelf:', isSelf);

    return {
        embeds: [buildEmbed(character)],
        components: isSelf ? [buildActionRow(character)] : [],
    };
}


/**
 * Creates a richly formatted embed for a character.
 */
function buildEmbed(character) {
    const embed = new EmbedBuilder();

    if (character.avatar_url) {
        embed.setImage(character.avatar_url);
    }

    embed.setTitle(character.name || 'Unnamed Character');

    if (character.bio) {
        embed.setDescription(`_${character.bio}_`);
    }

    const parsedStats = parseCharacterStats(character.stats || []);

    for (const para of parsedStats.paragraphFields) {
        embed.addFields({
            name: `**${para.label}**`,
            value: para.value.length > 400 ? para.value.slice(0, 397) + '…' : para.value,
            inline: false,
        });
    }

    const displayStrings = parsedStats.gridFields.map(formatStatDisplay);
    for (let i = 0; i < displayStrings.length; i += 2) {
        const left = displayStrings[i] ?? '\u200B';
        const right = displayStrings[i + 1] ?? '\u200B';

        embed.addFields(
            { name: '\u200B', value: left, inline: true },
            { name: '\u200B', value: right, inline: true },
        );
    }

    const isPublic = (character.visibility || 'private').toLowerCase() === 'public';
    const pubLabel = isPublic ? '🌐 Published' : '🔒 Not Published';

    embed.addFields({
        name: 'Visibility',
        value: isPublic
            ? `${pubLabel}`
            : `${pubLabel}\n_Publishing your character allows other players to see it and may unlock in-game features._`,
        inline: true,
    });

    embed.setFooter({
        text: `Created on ${new Date(character.created_at).toLocaleDateString()} (${formatTimeAgo(character.created_at)})`,
    });

    return embed;
}

/**
 * Builds the full action row for editing a character.
 */
function buildActionRow(character) {
    return new ActionRowBuilder().addComponents(
        buildEditCharacterStatsButton(character.id),
        buildCalculateStatsButton(character.id),
        buildViewParagraphFieldsButton(character.id),
        buildToggleCharacterVisibilityButton(character.id, character.visibility),
        buildDeleteCharacterButton(character.id),
    );
}

/**
 * Normalizes and buckets stat fields into paragraph and grid sections.
 */
function parseCharacterStats(stats) {
    const statMap = new Map();

    for (const stat of stats) {
        const { label, value, meta = {}, field_type, template_id } = stat;
        const key = (label || template_id || '??').toUpperCase();
        if (!key) continue;

        const bucket = {
            label: key,
            value: null,
            current: null,
            max: null,
            type: field_type,
            sort_index: stat.sort_index ?? stat.template_sort_index ?? 999,
        };

        if (field_type === 'count') {
            bucket.max = meta.max ?? null;
            bucket.current = meta.current ?? meta.max ?? null;
        } else {
            bucket.value = value;
        }

        statMap.set(key, bucket);
    }

    const sorted = Array.from(statMap.values()).sort((a, b) => a.sort_index - b.sort_index);

    const paragraphFields = [];
    const gridFields = [];

    for (const stat of sorted) {
        if (stat.type === 'paragraph') {
            if ((stat.value || '').trim()) {
                paragraphFields.push({ label: stat.label, value: stat.value.trim() });
            }
        } else {
            gridFields.push(stat);
        }
    }

    return { paragraphFields, gridFields };
}

/**
 * Converts an individual stat into a display-ready string.
 */
function formatStatDisplay(stat) {
    if (stat.type === 'count' && stat.max !== null) {
        return `**${stat.label}**: ${stat.current ?? stat.max} / ${stat.max}`;
    } else if (stat.value !== undefined && stat.value !== null && stat.value !== '') {
        return `**${stat.label}**: ${stat.value}`;
    } else {
        return `**${stat.label}**: _Not set_`;
    }
}

module.exports = { build };
