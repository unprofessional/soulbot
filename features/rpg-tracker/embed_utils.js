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

    // === Avatar (Featured Image) ===
    if (character.avatar_url) {
        embed.setImage(character.avatar_url); // 👈 use as large image instead of thumbnail
    }

    // === Header ===
    const name = character.name || 'Unnamed Character';
    const visibility = (character.visibility || 'private').toLowerCase();
    const visibilityEmoji = visibility === 'public' ? '🔓' : '🔒';
    const visibilityLabel = `${visibilityEmoji} ${visibility.charAt(0).toUpperCase() + visibility.slice(1)}`;

    embed.setTitle(name);
    embed.addFields(
        { name: 'Visibility', value: visibilityLabel, inline: true }
    );

    // === Extract GAME Stats (excluding core + HP/Max HP) ===
    const allStats = character.stats || [];
    const coreFields = ['name', 'avatar_url', 'bio', 'visibility'];
    const excluded = ['hp', 'max_hp', ...coreFields];
    const gameStats = allStats.filter(s => !excluded.includes((s.name || s.label || '').toLowerCase()));

    // Sort by GM-defined order
    const sorted = gameStats.sort((a, b) => {
        const aIndex = a.sort_index ?? a.template_sort_index ?? 999;
        const bIndex = b.sort_index ?? b.template_sort_index ?? 999;
        return aIndex - bIndex;
    });

    // 2 columns, filling row-wise
    const leftStats = [];
    const rightStats = [];

    sorted.forEach((s, i) => {
        const str = `**${s.label}**: ${s.value}`;
        if (i % 2 === 0) leftStats.push(str);
        else rightStats.push(str);
    });

    const maxRows = Math.ceil(sorted.length / 2);
    for (let i = 0; i < maxRows; i++) {
        const left = leftStats[i] ?? '\u200B';
        const right = rightStats[i] ?? '\u200B';
        embed.addFields(
            { name: '\u200B', value: left, inline: true },
            { name: '\u200B', value: right, inline: true }
        );
    }

    // === Bio ===
    if (character.bio) {
        embed.setDescription(`_${character.bio}_`);
    }

    // === Footer ===
    embed.setFooter({
        text: `Created on ${new Date(character.created_at).toLocaleDateString()}`,
    });

    return embed;
}

function buildCharacterActionRow(characterId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`edit_stat:${characterId}`)
            .setLabel('🎲 Edit Stat')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`edit_character:${characterId}`)
            .setLabel('📝 Edit Info')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`view_inventory:${characterId}`)
            .setLabel('📦 Inventory')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`toggle_visibility:${characterId}`)
            .setLabel('👁️ Toggle Visibility')
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
