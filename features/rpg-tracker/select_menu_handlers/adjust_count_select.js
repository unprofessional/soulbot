// features/rpg-tracker/select_menu_handlers/adjust_count_select.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

async function handle(interaction) {
    const [selected] = interaction.values;
    const [, statId] = selected.split(':'); // value is like `adjust:<statId>`
    const [, characterId] = interaction.customId.split(':');

    const modal = new ModalBuilder()
        .setCustomId(`adjustStatModal:${characterId}:${statId}`)
        .setTitle('Adjust Stat Value');

    const deltaInput = new TextInputBuilder()
        .setCustomId('deltaValue')
        .setLabel('Amount to add or subtract (e.g. -2 or 5)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter a number');

    const row = new ActionRowBuilder().addComponents(deltaInput);
    modal.addComponents(row);

    return await interaction.showModal(modal);
}

module.exports = { handle };
