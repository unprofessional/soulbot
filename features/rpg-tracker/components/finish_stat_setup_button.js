// features/rpg-tracker/components/finish_stat_setup_button.js

const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { rebuildCreateGameResponse } = require('../utils/rebuild_create_game_response');

const id = 'finishStatSetup';

function build(gameId) {
    return {
        custom_id: `${id}:${gameId}`,
        label: '↩️ Cancel / Go Back',
        style: 'SECONDARY',
    };
}

async function handle(interaction) {
    const [, gameId] = interaction.customId.split(':');

    try {
        const [game, stats] = await Promise.all([
            getGame({ id: gameId }),
            getStatTemplates(gameId),
        ]);

        if (!game) {
            return await interaction.reply({
                content: '❌ Game not found. You may need to recreate it.',
                ephemeral: true,
            });
        }

        await interaction.deferUpdate();
        await interaction.editReply(rebuildCreateGameResponse(game, stats));
    } catch (err) {
        console.error('Error in finishStatSetup:', err);
        return await interaction.reply({
            content: '❌ Something went wrong while finalizing your game setup.',
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
