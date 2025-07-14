// features/rpg-tracker/components/view_game_stat_card.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { id: defineStatsId } = require('./define_stats_button');
const { id: editStatsId } = require('./edit_stat_button');
const { id: deleteStatsId } = require('./delete_stat_button');
const { id: togglePublishId } = require('./toggle_publish_button');

/**
 * Build the stat template embed + button row for a game.
 */
function build(game, fields = [], highlightLabel = null) {
    return {
        embeds: [buildEmbed(fields, game, highlightLabel)],
        components: [buildButtonRow(game.id, fields)],
    };
}

function buildEmbed(fields, game, highlightLabel = null) {
    const fieldLines = fields.map(f => {
        const isNew = highlightLabel && f.label?.toLowerCase() === highlightLabel.toLowerCase();
        const icon = f.field_type === 'paragraph' ? '📝' : '🔹';
        const defaultStr = f.default_value ? ` _(default: ${f.default_value})_` : '';
        const labelWithType = `${f.label} \`${f.field_type}\``;
        return `${icon} ${isNew ? '**🆕 ' : '**'}${labelWithType}**${defaultStr}`;
    });

    return new EmbedBuilder()
        .setTitle('📋 GAME Character Stats')
        .setDescription([
            fieldLines.length ? fieldLines.join('\n') : '*No stats defined yet.*',
            '',
            '**Game Visibility**',
            game.is_public
                ? '`Public ✅` — Players can use `/join-game`'
                : '`Draft ❌` — Not yet visible to players',
        ].join('\n'))
        .setColor(game.is_public ? 0x00c851 : 0xffbb33);
}

function buildButtonRow(gameId, fields = []) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${defineStatsId}:${gameId}`)
            .setLabel(fields.length > 0 ? '➕ Add Another Stat' : 'Define Required Stats')
            .setStyle(ButtonStyle.Primary)
    );

    if (fields.length > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${editStatsId}:${gameId}`)
                .setLabel('🎲 Edit Stat')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`${deleteStatsId}:${gameId}`)
                .setLabel('🗑️ Delete Stat')
                .setStyle(ButtonStyle.Danger)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${togglePublishId}:${gameId}`)
            .setLabel('📣 Toggle Visibility')
            .setStyle(ButtonStyle.Success)
    );

    return row;
}

module.exports = { build };
