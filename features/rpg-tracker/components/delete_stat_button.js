// features/rpg-tracker/components/delete_stat_button.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getGame, getStatTemplates } = require('../../../store/services/game.service');

const id = 'deleteStats';

function build(gameId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setLabel('🗑️ Delete Stat')
        .setStyle(ButtonStyle.Danger);
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

    const options = statTemplates.map((f, i) => ({
        label: `${i + 1}. ${f.label}`,
        description: `Type: ${f.field_type}`,
        value: f.id,
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`deleteStatSelect:${gameId}`)
        .setPlaceholder('Select a stat field to delete')
        .addOptions(options);

    const cancelBtn = new ButtonBuilder()
        .setCustomId(`finishStatSetup:${gameId}`)
        .setLabel('↩️ Cancel / Go Back')
        .setStyle(ButtonStyle.Secondary);

    return await interaction.update({
        content: `🗑️ Select a stat field to delete from **${game.name}**`,
        components: [
            new ActionRowBuilder().addComponents(selectMenu),
            new ActionRowBuilder().addComponents(cancelBtn),
        ],
        embeds: [],
    });
}

module.exports = { id, build, handle };
