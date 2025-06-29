// features/rpg-tracker/utils/rebuild_create_game_response.js

const { buildGameStatTemplateEmbed, buildGameStatActionRow } = require('../embeds/game_stat_embed');

/**
 * Reconstructs the original /create-game message response.
 * Useful after adding/editing stats to return the full campaign setup view.
 * 
 * @param {Object} game - The game object
 * @param {Array<Object>} statTemplates - List of stat fields
 * @param {string} [highlightLabel] - Optional field label to highlight (e.g. newly added)
 * @returns {{ content: string, embeds: object[], components: ActionRowBuilder[] }}
 */
function rebuildCreateGameResponse(game, statTemplates, highlightLabel = null) {
    const content = [
        `✅ Created game **${game.name}** and set it as your active campaign.`,
        ``,
        `**Character Stat Fields:**`,
        ` - 🟦 **System Fields** (always included):`,
        `  - Name`,
        `  - Avatar URL`,
        `  - Bio`,
        ``,
        ` - 🟨 **Game Fields** (you define these)`,
        `  - Ex: HP, Strength, Skills, etc.`,
        ``,
        `Use the buttons below to define your required game-specific stat fields or to publish the game.`,
        `_You do **not** need to redefine system fields._`,
    ].join('\n');

    const embed = buildGameStatTemplateEmbed(statTemplates, game, highlightLabel);
    const buttons = buildGameStatActionRow(game.id);

    return {
        content,
        embeds: [embed.toJSON()],
        components: [buttons],
    };
}

module.exports = {
    rebuildCreateGameResponse,
};
