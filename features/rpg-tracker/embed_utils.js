// features/rpg-tracker/embed_utils.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { formatTimeAgo } = require('./utils/time_ago');

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

function buildCharacterEmbed(character) {
    console.log('🧩 buildCharacterEmbed > character input:', character);

    const embed = new EmbedBuilder();

    if (character.avatar_url) {
        embed.setImage(character.avatar_url);
    }

    const name = character.name || 'Unnamed Character';
    const visibility = (character.visibility || 'private').toLowerCase();
    const visibilityEmoji = visibility === 'public' ? '🔓' : '🔒';
    const visibilityLabel = `${visibilityEmoji} ${visibility.charAt(0).toUpperCase() + visibility.slice(1)}`;

    embed.setTitle(name);
    embed.addFields({ name: 'Visibility', value: visibilityLabel, inline: true });

    const allStats = character.stats || [];
    console.log('📊 Stats array:', allStats);

    const statMap = new Map();

    for (const stat of allStats) {
        const { label, value, meta = {}, field_type, template_id } = stat;
        console.log('🔍 Stat:', { label, value, meta, field_type });

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

    const combined = Array.from(statMap.values()).sort((a, b) => a.sort_index - b.sort_index);
    console.log('🧱 Combined stat buckets:', combined);

    const paragraphStats = [];
    const columnStats = [];

    for (const stat of combined) {
        if (stat.type === 'paragraph') {
            const val = (stat.value || '').trim();
            if (!val) continue;
            paragraphStats.push({
                name: `**${stat.label}**`,
                value: val.length > 100 ? val.slice(0, 97) + '…' : val,
                inline: false,
            });
        } else {
            columnStats.push(stat);
        }
    }

    // Add paragraph fields first
    for (const para of paragraphStats) {
        embed.addFields(para);
    }

    // Then render remaining stats as 2-column rows
    const leftStats = [];
    const rightStats = [];

    for (let i = 0; i < columnStats.length; i++) {
        const stat = columnStats[i];
        let display = '';

        if (stat.type === 'count' && stat.max !== null) {
            display = `${stat.label}: ${stat.current ?? stat.max} / ${stat.max}`;
        } else if (stat.value !== undefined && stat.value !== null && stat.value !== '') {
            display = `**${stat.label}**: ${stat.value}`;
        } else {
            display = `**${stat.label}**: _Not set_`;
        }

        if (i % 2 === 0) leftStats.push(display);
        else rightStats.push(display);
    }

    const rows = Math.max(leftStats.length, rightStats.length);
    for (let i = 0; i < rows; i++) {
        embed.addFields(
            { name: '\u200B', value: leftStats[i] ?? '\u200B', inline: true },
            { name: '\u200B', value: rightStats[i] ?? '\u200B', inline: true }
        );
    }

    if (character.bio) {
        embed.setDescription(`_${character.bio}_`);
    }

    embed.setFooter({
        text: `Created on ${new Date(character.created_at).toLocaleDateString()} (${formatTimeAgo(character.created_at)})`,
    });

    return embed;
}

function buildCharacterActionRow(characterId, visibility = 'private') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`edit_stat:${characterId}`)
            .setLabel('🎲 Edit Stat')
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`adjust_stats:${characterId}`)
            .setLabel('➕/➖ Adjust Stats')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(`toggle_visibility:${characterId}`)
            .setLabel(
                visibility === 'public'
                    ? '🔒 Unpublish Character'
                    : '🌐 Publish Character'
            )
            .setStyle(ButtonStyle.Secondary)
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
