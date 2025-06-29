const { buildGameStatTemplateEmbed, buildGameStatActionRow } = require('../embeds/game_stat_embed');

/**
 * Builds the top-level instructional message for the game setup screen.
 * @param {Object} game - Game object
 * @param {'create'|'view'} context - Whether this is from /create-game or /view-game
 * @param {Array<Object>} statTemplates - Game-defined stat fields
 * @returns {string}
 */
function buildGameSetupMessage(game, context = 'create', statTemplates = []) {
    const lines = [];

    if (context === 'create') {
        lines.push(`✅ Created game **${game.name}** and set it as your active campaign.`);
    } else {
        lines.push(`🎲 Viewing game **${game.name}**.`);
    }

    lines.push('');

    if (game.description?.trim()) {
        const desc = game.description.trim().slice(0, 200);
        lines.push(`> ${desc}${game.description.length > 200 ? '…' : ''}`);
    }

    lines.push('');
    lines.push(`🟦 **SYSTEM Character Fields** (always included):`);
    lines.push(`- Name`);
    lines.push(`- Avatar URL`);
    lines.push(`- Bio`);

    if (statTemplates.length === 0) {
        lines.push('');
        lines.push(`🟨 **Game Fields** (you define these)`);
        lines.push(`- Ex: HP, Strength, Skills, etc.`);
    }

    lines.push('');

    if (context === 'create') {
        lines.push(`Use the buttons below to define your required game-specific stat fields or to publish the game.`);
        lines.push(`_You do **not** need to redefine system fields._`);
    } else {
        lines.push(`Use the buttons below to manage stat fields or update game info.`);
    }

    return lines.join('\n');
}

/**
 * Reconstructs the original /create-game or /view-game message response.
 * @param {Object} game - The game object
 * @param {Array<Object>} statTemplates - List of stat fields
 * @param {string} [highlightLabel] - Optional field label to highlight (e.g. newly added)
 * @param {'create'|'view'} [context='create'] - Determines message copy
 * @returns {{ content: string, embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function rebuildCreateGameResponse(game, statTemplates, highlightLabel = null, context = 'create') {
    const content = buildGameSetupMessage(game, context, statTemplates);
    const embed = buildGameStatTemplateEmbed(statTemplates, game, highlightLabel);
    const buttons = buildGameStatActionRow(game.id, statTemplates);

    return {
        content,
        embeds: [embed],
        components: [buttons],
    };
}

module.exports = {
    rebuildCreateGameResponse,
};
