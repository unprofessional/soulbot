// features/rpg-tracker/components/create_stat_modal.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const {
    addStatTemplates,
    getStatTemplates,
    getGame,
} = require('../../../store/services/game.service');

const {
    rebuildCreateGameResponse,
} = require('../utils/rebuild_create_game_response');

const id = 'createStatModal';

function build(gameId, statType) {
    console.log('[create_stat_modal.build] Inputs:', { gameId, statType });
    const labelInput = new TextInputBuilder()
        .setCustomId('label')
        .setLabel("Field Label: What's it called?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const defaultInput = new TextInputBuilder()
        .setCustomId('default_value')
        .setLabel('Default Value (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    const sortInput = new TextInputBuilder()
        .setCustomId('sort_index')
        .setLabel('Sort Order (optional): 0=top, 9=lower')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    return new ModalBuilder()
        .setCustomId(`${id}:${gameId}:${statType}`)
        .setTitle(`Add ${statType.replace('-', ' ')} stat`)
        .addComponents(
            new ActionRowBuilder().addComponents(labelInput),
            new ActionRowBuilder().addComponents(defaultInput),
            new ActionRowBuilder().addComponents(sortInput)
        );
}

async function handle(interaction) {
    console.log('[create_stat_modal] Received modal submission with customId:', interaction.customId);

    const [, gameId, statType] = interaction.customId.split(':');

    const label = interaction.fields.getTextInputValue('label')?.trim().toUpperCase();
    const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim() || null;
    const sortIndexRaw = interaction.fields.getTextInputValue('sort_index')?.trim();
    const sort_index = sortIndexRaw ? parseInt(sortIndexRaw, 10) : null;

    if (!label || !['number', 'count', 'short', 'paragraph'].includes(statType)) {
        return interaction.reply({
            content: '⚠️ Invalid input or stat type.',
            ephemeral: true,
        });
    }

    await addStatTemplates(gameId, [
        {
            label,
            field_type: statType,
            default_value: defaultValue,
            sort_index,
        },
    ]);

    const [game, statTemplates] = await Promise.all([
        getGame({ id: gameId }),
        getStatTemplates(gameId),
    ]);

    const response = rebuildCreateGameResponse(game, statTemplates, label);
    return interaction.update(response);
}

module.exports = {
    id,
    build,
    handle,
};
