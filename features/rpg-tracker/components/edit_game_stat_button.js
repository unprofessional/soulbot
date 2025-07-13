// features/rpg-tracker/components/edit_stat_button.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { build: buildCancelButton } = require('./finish_stat_setup_button');
const { build: buildEditStatSelectorRow } = require('./edit_stat_selector');

const id = 'editGameStats';

function build(gameId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setLabel('🎲 Edit Stat')
        .setStyle(ButtonStyle.Secondary);
}

async function handle(interaction) {
    const [, gameId] = interaction.customId.split(':');
    const game = await getGame({ id: gameId });
    const statTemplates = await getStatTemplates(gameId);

    if (!game || game.created_by !== interaction.user.id) {
        return await interaction.reply({
            content: '⚠️ Only the GM can edit this game.',
            ephemeral: true,
        });
    }

    if (!statTemplates.length) {
        return await interaction.reply({
            content: '⚠️ No stats to edit yet. Use "Define Required Stats" first.',
            ephemeral: true,
        });
    }

    const selectRow = buildEditStatSelectorRow(gameId, statTemplates);
    const cancelBtn = new ButtonBuilder(buildCancelButton(gameId));

    return await interaction.update({
        content: `🎲 Select a field to edit for **${game.name}**`,
        components: [
            selectRow,
            new ActionRowBuilder().addComponents(cancelBtn),
        ],
        embeds: [],
    });
}

module.exports = { id, build, handle };
