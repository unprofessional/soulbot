// features/rpg-tracker/embed_utils.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

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
    const embed = new EmbedBuilder();

    // === Avatar ===
    if (character.avatar_url) {
        embed.setImage(character.avatar_url);
    }

    // === Header ===
    const name = character.name || 'Unnamed Character';
    const visibility = (character.visibility || 'private').toLowerCase();
    const visibilityEmoji = visibility === 'public' ? '🔓' : '🔒';
    const visibilityLabel = `${visibilityEmoji} ${visibility.charAt(0).toUpperCase() + visibility.slice(1)}`;
    embed.setTitle(name);
    embed.addFields({ name: 'Visibility', value: visibilityLabel, inline: true });

    const allStats = character.stats || [];
    const coreFields = ['name', 'avatar_url', 'bio', 'visibility'];

    // === Group by label to find MAX / CURRENT pairs ===
    const statMap = new Map(); // label => { max, current, type, sort_index }

    for (const stat of allStats) {
        const { name, label, value, type, sort_index, template_sort_index } = stat;
        const key = (label || '').toUpperCase();
        if (!key || coreFields.includes(name)) continue;

        const bucket = statMap.get(key) || { label: key, max: null, current: null, type, sort_index: sort_index ?? template_sort_index ?? 999 };

        if (name.includes(':max')) bucket.max = value;
        else if (name.includes(':current')) bucket.current = value;
        else bucket.value = value;

        statMap.set(key, bucket);
    }

    const combined = Array.from(statMap.values());

    // Sort
    combined.sort((a, b) => a.sort_index - b.sort_index);

    // Build rows
    const leftStats = [];
    const rightStats = [];

    for (let i = 0; i < combined.length; i++) {
        const stat = combined[i];
        let display = '';

        if (stat.max !== null) {
            const current = stat.current ?? stat.max;
            display = `⚔️ ${stat.label}: ${current} / ${stat.max}`;
        } else if (stat.value !== undefined) {
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

    // === Bio ===
    if (character.bio) {
        embed.setDescription(`_${character.bio}_`);
    }

    // === Footer ===
    embed.setFooter({ text: `Created on ${new Date(character.created_at).toLocaleDateString()}` });

    return embed;
}

function buildCharacterActionRow(characterId, visibility = 'private') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`edit_stat:${characterId}`)
            .setLabel('🎲 Edit Stat')
            .setStyle(ButtonStyle.Primary),

        /**
         * DEPRECATED
         */

        // new ButtonBuilder()
        //     .setCustomId(`edit_character:${characterId}`)
        //     .setLabel('📝 Edit Info')
        //     .setStyle(ButtonStyle.Secondary),

        /**
         * TODO: NOT YET PROPERLY IMPLEMENTED
         */

        // new ButtonBuilder()
        //     .setCustomId(`view_inventory:${characterId}`)
        //     .setLabel('📦 Inventory')
        //     .setStyle(ButtonStyle.Secondary),

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
