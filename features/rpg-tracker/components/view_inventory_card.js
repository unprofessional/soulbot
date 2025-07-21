// features/rpg-tracker/components/view_inventory_card.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const id = 'viewInventoryCard';

/**
 * Builds the inventory view embed and action buttons.
 * @param {object} character - Full hydrated character with inventory
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function build(character) {
    const items = character.inventory || [];

    const itemLines = items.map(item => {
        const equipped = item.equipped ? '✅' : '▫️';
        const typeText = item.type ? `(${item.type})` : '';
        const descText = item.description ? ` — _${item.description}_` : '';
        return `${equipped} **${item.name}** ${typeText}${descText}`;
    });

    const embed = new EmbedBuilder()
        .setTitle(`${character.name} — Inventory`)
        .setDescription(itemLines.join('\n') || '_Empty_')
        .setFooter({ text: 'Equipped items marked with ✅' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`add_inventory_item:${character.id}`)
            .setLabel('➕ Add Item')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`clear_inventory:${character.id}`)
            .setLabel('🗑️ Delete All')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [row],
    };
}

module.exports = { id, build };
