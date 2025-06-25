// features/rpg-tracker/embed_utils.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

function buildCharacterEmbed(character) {
    const statMap = Object.fromEntries(character.stats.map(s => [s.name.toLowerCase(), s.value]));
    const statStr = character.stats
        .map(s => `**${s.name.toUpperCase()}**: ${s.value}`)
        .join(' | ') || 'No stats found';

    const hp = statMap.hp ?? '—';
    const maxHp = statMap.max_hp ?? '—';

    const embed = new EmbedBuilder()
        .setTitle(`${character.name} — Level ${character.level || 1} ${character.class || 'Unclassed'}`)
        .setDescription(`*${character.race || 'Unknown Race'}*`)
        .addFields(
            { name: 'HP', value: `${hp} / ${maxHp}`, inline: true },
            { name: 'Stats', value: statStr, inline: false }
        )
        .setFooter({
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
    buildCharacterEmbed,
    buildCharacterActionRow,
    buildInventoryEmbed,
    buildInventoryActionRow,
};
