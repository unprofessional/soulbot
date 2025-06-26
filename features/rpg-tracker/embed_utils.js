const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

function buildGameEmbed(game, characters = []) {
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
            }
        )
        .setFooter({ text: `Created by ${game.created_by}` })
        .setTimestamp(new Date(game.created_at));

    return embed;
}

function buildCharacterEmbed(character) {
    // Ensure each stat has a 'label' (fallback to 'name' or 'template_id')
    const statStr = (character.stats || [])
        .map(s => {
            const label = s.label || s.name || s.template_id || '???';
            return `**${label.toUpperCase()}**: ${s.value}`;
        })
        .join(' | ') || 'No stats found';

    const statMap = Object.fromEntries(
        (character.stats || []).map(s => [s.label?.toLowerCase() || s.name?.toLowerCase(), s.value])
    );

    const hp = statMap.hp ?? '—';
    const maxHp = statMap.max_hp ?? '—';

    return new EmbedBuilder()
        .setTitle(`${character.name} — Level ${character.level || 1} ${character.class || 'Unclassed'}`)
        .setDescription(`*${character.race || 'Unknown Race'}*`)
        .addFields(
            { name: 'HP', value: `${hp} / ${maxHp}`, inline: true },
            { name: 'Stats', value: statStr, inline: false }
        )
        .setFooter({
            text: `Created on ${new Date(character.created_at).toLocaleDateString()}`,
        });
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
