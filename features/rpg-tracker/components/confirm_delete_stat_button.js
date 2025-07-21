// features/rpg-tracker/components/confirm_delete_stat_button.js

const {
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getStatTemplateById,
    deleteStatTemplate,
    getGame,
    getStatTemplates,
} = require('../../../store/services/game.service');

const { rebuildCreateGameResponse } = require('../utils/rebuild_create_game_response');

const id = 'confirmDeleteStat';

function build(statId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${statId}`)
        .setLabel('✅ Confirm Delete')
        .setStyle(ButtonStyle.Danger);
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const [, statId] = interaction.customId.split(':');

    try {
        const stat = await getStatTemplateById(statId);
        if (!stat) {
            return await interaction.reply({
                content: '❌ That stat no longer exists.',
                ephemeral: true,
            });
        }

        await deleteStatTemplate(statId);

        const [game, updatedStats] = await Promise.all([
            getGame({ id: stat.game_id }),
            getStatTemplates(stat.game_id),
        ]);

        return await interaction.update(rebuildCreateGameResponse(game, updatedStats));
    } catch (err) {
        console.error('Error confirming stat deletion:', err);
        return await interaction.reply({
            content: '❌ Failed to delete stat.',
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
