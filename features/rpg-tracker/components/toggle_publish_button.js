// features/rpg-tracker/components/toggle_publish_button.js

const {
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getOrCreatePlayer } = require('../../../store/services/player.service');
const { togglePublish, getStatTemplates } = require('../../../store/services/game.service');
const { rebuildCreateGameResponse } = require('../utils/rebuild_create_game_response');

/** Component ID prefix */
const id = 'togglePublishGame';

/**
 * Builds the "Toggle Visibility" button for a game
 * @param {string} gameId
 * @returns {ButtonBuilder}
 */
function build(gameId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setLabel('📣 Toggle Visibility')
        .setStyle(ButtonStyle.Success);
}

/**
 * Handles the button interaction to toggle game publish status
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const [, gameId] = interaction.customId.split(':');

    try {
        const guildId = interaction.guild?.id;
        const userId = interaction.user.id;

        const player = await getOrCreatePlayer(userId, guildId);

        if (player?.role !== 'gm' || player.current_game_id !== gameId) {
            return await interaction.reply({
                content: '⚠️ Only the GM of this game can change its publish status.',
                ephemeral: true,
            });
        }

        const updatedGame = await togglePublish(gameId);
        const statTemplates = await getStatTemplates(gameId);

        const rebuilt = rebuildCreateGameResponse(updatedGame, statTemplates);

        return await interaction.update(rebuilt);

    } catch (err) {
        console.error('[togglePublishGame] Error:', err);
        return await interaction.reply({
            content: '❌ Failed to toggle publish state. Try again later.',
            ephemeral: true,
        });
    }
}

module.exports = {
    id,
    build,
    handle,
};
