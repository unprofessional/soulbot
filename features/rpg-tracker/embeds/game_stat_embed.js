// features/rpg-tracker/embeds/game_stat_embed.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

/**
 * Builds the updated embed showing the stat template and visibility.
 * Highlights the `highlightLabel` field if provided.
 * @param {Array<Object>} fields
 * @param {Object} game
 * @param {string} [highlightLabel]
 * @returns {EmbedBuilder}
 */
function buildGameStatTemplateEmbed(fields, game, highlightLabel = null) {
    const fieldLines = fields.map(f => {
        const isNew = highlightLabel && f.label?.toLowerCase() === highlightLabel.toLowerCase();
        const icon = f.field_type === 'paragraph' ? '📝' : '🔹';
        const defaultStr = f.default_value ? ` _(default: ${f.default_value})_` : '';
        return `${icon} ${isNew ? '**🆕 ' : '**'}${f.label}**${defaultStr}`;
    });

    const embed = new EmbedBuilder()
        .setTitle('📋 Current Stat Template')
        .addFields(
            {
                name: '📊 Stat Fields',
                value: fieldLines.length ? fieldLines.join('\n') : '*No stats defined yet.*'
            },
            {
                name: '🔒 Game Visibility',
                value: game.is_public
                    ? '`Public ✅` — Players can use `/join-game`'
                    : '`Draft ❌` — Not yet visible to players'
            }
        )
        .setColor(game.is_public ? 0x00c851 : 0xffbb33);

    return embed;
}

/**
 * Button row for use under the stat embed after `/create-game`
 * @param {Object} game - The full game object
 * @returns {ActionRowBuilder}
 */
function buildGameStatActionRow(game) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`defineStats:${game.id}`)
            .setLabel('➕ Add Another Stat')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`editStats:${game.id}`)
            .setLabel('🎲 Edit Stat')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`togglePublishGame:${game.id}`)
            .setLabel(game.is_public ? '🙈 Unpublish Game' : '📣 Publish Game')
            .setStyle(game.is_public ? ButtonStyle.Danger : ButtonStyle.Success)
    );
}

module.exports = {
    buildGameStatTemplateEmbed,
    buildGameStatActionRow,
};
