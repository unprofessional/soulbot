// features/rpg-tracker/embed_utils.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildCharacterEmbed(character) {
    const statStr = character.stats.map(s => `**${s.name.toUpperCase()}**: ${s.value}`).join(' | ');

    const embed = new EmbedBuilder()
        .setTitle(`${character.name} — Level ${character.level} ${character.class}`)
        .setDescription(`*${character.race || 'Unknown Race'}*`)
        .addFields(
            { name: 'HP', value: `${character.hp} / ${character.max_hp}`, inline: true },
            { name: 'Stats', value: statStr || 'N/A', inline: true }
        )
        .setFooter({ text: `Created on ${new Date(character.created_at).toLocaleDateString()}` });

    return embed;
}

function buildCharacterActionRow(characterId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`edit_hp:${characterId}`)
            .setLabel('❤️ Edit HP')
            .setStyle(ButtonStyle.Secondary),
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

module.exports = {
    buildCharacterEmbed,
    buildCharacterActionRow,
};
