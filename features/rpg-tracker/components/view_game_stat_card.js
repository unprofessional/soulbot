// features/rpg-tracker/components/view_game_stat_card.js

const { EmbedBuilder, ActionRowBuilder } = require('discord.js');

const { build: buildDefineStatsButton } = require('./define_stats_button');
const { build: buildEditGameStatsButton } = require('./edit_game_stat_button');
const { build: buildDeleteStatsButton } = require('./delete_stat_button');
const { build: buildTogglePublishButton } = require('./toggle_publish_button');

/**
 * Builds a stat template embed + button row for the given game.
 * @param {object} game - The game object
 * @param {Array<object>} fields - Stat template definitions
 * @param {string} [highlightLabel] - Optional label to highlight
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
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
        buildDefineStatsButton(gameId)
    );

    if (fields.length > 0) {
        row.addComponents(
            buildEditGameStatsButton(gameId),
            buildDeleteStatsButton(gameId)
        );
    }

    row.addComponents(
        buildTogglePublishButton(gameId)
    );

    return row;
}

module.exports = { build };
