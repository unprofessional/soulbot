// features/rpg-tracker/components/delete_stat_button.js

const {
    ActionRowBuilder,
    ButtonBuilder,
} = require('discord.js');

const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { build: buildCancelButton } = require('./finish_stat_setup_button');
const { build: buildDeleteStatSelectorRow } = require('./delete_stat_selector');

const id = 'deleteStats';

function build(gameId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setLabel('🗑️ Delete Stat')
        .setStyle('DANGER');
}

async function handle(interaction) {
    const [, gameId] = interaction.customId.split(':');
    const game = await getGame({ id: gameId });
    const statTemplates = await getStatTemplates(gameId);

    if (!game || game.created_by !== interaction.user.id) {
        return await interaction.reply({
            content: '⚠️ Only the GM can delete stat fields.',
            ephemeral: true,
        });
    }

    if (!statTemplates.length) {
        return await interaction.reply({
            content: '⚠️ No stats to delete.',
            ephemeral: true,
        });
    }

    const selectRow = buildDeleteStatSelectorRow(gameId, statTemplates);
    const cancelBtn = new ButtonBuilder(buildCancelButton(gameId));

    return await interaction.update({
        content: `🗑️ Select a stat field to delete from **${game.name}**`,
        components: [
            selectRow,
            new ActionRowBuilder().addComponents(cancelBtn),
        ],
        embeds: [],
    });
}

module.exports = { id, build, handle };
