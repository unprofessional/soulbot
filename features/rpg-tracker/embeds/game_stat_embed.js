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
        .setDescription([
            fieldLines.length ? fieldLines.join('\n') : '*No stats defined yet.*',
            '',
            '**Game Visibility**',
            game.is_public
                ? '`Public ✅` — Players can use `/join-game`'
                : '`Draft ❌` — Not yet visible to players',
        ].join('\n'))
        .setColor(game.is_public ? 0x00c851 : 0xffbb33);

    return embed;
}

/**
 * Button row for use under the stat embed after `/create-game`
 * @param {string} gameId
 * @returns {ActionRowBuilder}
 */
function buildGameStatActionRow(gameId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`defineStats:${gameId}`)
            .setLabel('➕ Add Another Stat')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`editStats:${gameId}`)
            .setLabel('🎲 Edit Stat')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`publishGame:${gameId}`)
            .setLabel('📣 Publish Now')
            .setStyle(ButtonStyle.Success)
    );
}

module.exports = {
    buildGameStatTemplateEmbed,
    buildGameStatActionRow,
};
