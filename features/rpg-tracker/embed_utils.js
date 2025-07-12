// features/rpg-tracker/embed_utils.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { formatTimeAgo } = require('./utils/time_ago');
const { build: buildDeleteCharacterButton } = require('./components/confirm_delete_character_button');

/** ////////////////
 * HELPER FUNCTIONS
 */ ////////////////

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

function formatStatDisplay(stat) {
    if (stat.type === 'count' && stat.max !== null) {
        return `**${stat.label}**: ${stat.current ?? stat.max} / ${stat.max}`;
    } else if (stat.value !== undefined && stat.value !== null && stat.value !== '') {
        return `**${stat.label}**: ${stat.value}`;
    } else {
        return `**${stat.label}**: _Not set_`;
    }
}

/**
 * Builds the embed for game views
 * @param {*} game 
 * @param {*} characters 
 * @param {*} statTemplates 
 * @returns 
 */
function buildGameEmbed(game, characters = [], statTemplates = []) {
    const coreFields = [
        { name: 'core:name', label: 'Name' },
        { name: 'core:avatar_url', label: 'Avatar URL' },
        { name: 'core:bio', label: 'Bio' },
        { name: 'core:visibility', label: 'Visibility' },
    ];

    const gameFieldLines = statTemplates.map(t => `• ${t.label || t.id}`);
    const coreFieldLines = coreFields.map(f => `• ${f.label}`);

    const embed = new EmbedBuilder()
        .setTitle(`🎲 ${game.name}`)
        .setDescription(game.description || '*No description provided.*')
        .addFields(
            {
                name: 'Visibility',
                value: game.is_public ? '🌐 Public' : '🔒 Private',
                inline: true,
            },
            {
                name: 'Character Count',
                value: `${characters.length}`,
                inline: true,
            },
            {
                name: 'System Fields (Always Available)',
                value: coreFieldLines.join('\n'),
                inline: false,
            },
            {
                name: 'Game Fields (Defined by GM)',
                value: gameFieldLines.length > 0 ? gameFieldLines.join('\n') : '_None defined._',
                inline: false,
            }
        )
        .setFooter({ text: `Created by ${game.created_by}` })
        .setTimestamp(new Date(game.created_at));

    return embed;
}

/**
 * Builds the embed for character views
 * @param {*} character 
 * @returns 
 */
function buildCharacterEmbed(character) {
    console.log('🧩 buildCharacterEmbed > character input:', {
        id: character.id,
        name: character.name,
        visibility: character.visibility,
        created_at: character.created_at,
        avatar_url: character.avatar_url,
        statsCount: character.stats?.length || 0,
    });

    const embed = new EmbedBuilder();

    if (character.avatar_url) {
        embed.setImage(character.avatar_url);
    }

    const name = character.name || 'Unnamed Character';
    embed.setTitle(name);

    const parsedStats = parseCharacterStats(character.stats || []);
    console.log('📊 buildCharacterEmbed > paragraphFields:', parsedStats.paragraphFields);
    console.log('📊 buildCharacterEmbed > gridFields:', parsedStats.gridFields);

    for (const para of parsedStats.paragraphFields) {
        embed.addFields({
            name: `**${para.label}**`,
            value: para.value.length > 100 ? para.value.slice(0, 97) + '…' : para.value,
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
            { name: '\u200B', value: '\u200B', inline: true }
        );
    }

    if (character.bio) {
        embed.setDescription(`_${character.bio}_`);
    }

    const isPublic = (character.visibility || 'private').toLowerCase() === 'public';
    const pubLabel = isPublic ? '🌐 Published' : '🔒 Not Published';

    embed.setFooter({
        text: `${pubLabel} • Created on ${new Date(character.created_at).toLocaleDateString()} (${formatTimeAgo(character.created_at)})`,
    });

    return embed;
}

function buildCharacterActionRow(characterId, { isSelf = false, visibility = 'private' } = {}) {
    console.log(`🎛️ buildCharacterActionRow > characterId=${characterId} | isSelf=${isSelf} | visibility=${visibility}`);
    if (!isSelf) return null;

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`edit_stat:${characterId}`)
            .setLabel('✏️ Update Stats')
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`adjust_stats:${characterId}`)
            .setLabel('🧮 Calc Stats')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(`toggle_visibility:${characterId}`)
            .setLabel(
                visibility === 'public'
                    ? '🔒 Unpublish Character'
                    : '🌐 Publish Character'
            )
            .setStyle(ButtonStyle.Secondary),

        buildDeleteCharacterButton(characterId),

    );
}

function buildInventoryEmbed(character) {
    const items = character.inventory || [];

    const itemLines = items.map(item => {
        const equipped = item.equipped ? '✅' : '▫️';
        return `${equipped} **${item.name}** ${item.type ? `(${item.type})` : ''}${item.description ? ` — _${item.description}_` : ''}`;
    });

    return new EmbedBuilder()
        .setTitle(`${character.name} — Inventory`)
        .setDescription(itemLines.join('\n') || '_Empty_')
        .setFooter({ text: `Equipped items marked with ✅` });
}

function buildInventoryActionRow(characterId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`add_inventory_item:${characterId}`)
            .setLabel('➕ Add Item')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`clear_inventory:${characterId}`)
            .setLabel('🗑️ Delete All')
            .setStyle(ButtonStyle.Danger)
    );
}

module.exports = {
    buildGameEmbed,
    buildCharacterEmbed,
    buildCharacterActionRow,
    buildInventoryEmbed,
    buildInventoryActionRow,
};
