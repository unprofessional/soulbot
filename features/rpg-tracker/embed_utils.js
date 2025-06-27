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
    const embed = new EmbedBuilder()
        .setTitle(character.name || 'Unnamed Character')
        .setDescription(character.bio ? `_${character.bio}_` : '*No bio provided.*')
        .setFooter({
            text: `Created on ${new Date(character.created_at).toLocaleDateString()}`,
        });

    if (character.avatar_url) {
        embed.setThumbnail(character.avatar_url);
    }

    // === Visibility Badge ===
    const visibility = (character.visibility || '').toLowerCase();
    let visibilityEmoji = '❓';
    if (visibility === 'public') visibilityEmoji = '🔓';
    if (visibility === 'private') visibilityEmoji = '🔒';
    embed.addFields({
        name: 'Visibility',
        value: `${visibilityEmoji} ${visibility.charAt(0).toUpperCase() + visibility.slice(1)}`,
        inline: true,
    });

    // === HP Section ===
    const statMap = Object.fromEntries(
        (character.stats || []).map(s => [
            (s.label || s.name || '').toLowerCase(),
            s.value
        ])
    );
    const hp = statMap.hp;
    const maxHp = statMap.max_hp;

    if (hp || maxHp) {
        embed.addFields({
            name: 'HP',
            value: `${hp ?? '—'} / ${maxHp ?? '—'}`,
            inline: true,
        });
    }

    // === Other Stat Fields (sorted) ===
    const filteredStats = (character.stats || [])
        .filter(s => {
            const key = (s.label || '').toLowerCase();
            return key !== 'hp' && key !== 'max_hp';
        })
        .sort((a, b) => {
            const aIndex = a.sort_index ?? a.template_sort_index ?? 999;
            const bIndex = b.sort_index ?? b.template_sort_index ?? 999;
            return aIndex - bIndex;
        });

    const statStr = filteredStats.length
        ? filteredStats.map(s => `**${s.label}**: ${s.value}`).join('\n')
        : '_No stats found_';

    embed.addFields({
        name: 'Stats',
        value: statStr,
        inline: false,
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
