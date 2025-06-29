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
    console.log('[buildGameStatTemplateEmbed] Called with:', {
        gameName: game?.name,
        gameId: game?.id,
        isPublic: game?.is_public,
        fieldCount: fields?.length,
        highlightLabel,
    });

    const fieldLines = fields.map((f, index) => {
        const rawLabel = f.label;
        const rawDefault = f.default_value;
        const rawType = f.field_type;

        const isNew = highlightLabel && rawLabel?.toLowerCase() === highlightLabel.toLowerCase();
        const icon = rawType === 'paragraph' ? '📝' : '🔹';

        const safeLabel = typeof rawLabel === 'string' && rawLabel.trim().length > 0
            ? rawLabel.trim()
            : '(Unnamed)';
        const safeDefault = typeof rawDefault === 'string' && rawDefault.trim().length > 0
            ? rawDefault.trim()
            : null;

        const labelText = isNew ? `🆕 ${safeLabel}` : safeLabel;
        const defaultStr = safeDefault ? ` _(default: ${safeDefault})_` : '';

        // Prefix each line with a zero-width space to prevent Discord's embed parser from treating it as a list item
        const ZWSP = '\u200B';
        const finalLine = `${ZWSP}${icon} **${labelText}**${defaultStr}`;

        console.log(`[field ${index}]`, {
            rawLabel,
            safeLabel,
            rawDefault,
            safeDefault,
            rawType,
            icon,
            isNew,
            finalLine,
        });

        return finalLine;
    });

    const embedDescription = [
        fieldLines.length ? fieldLines.join('\n') : '*No stats defined yet.*',
        '',
        '**Game Visibility**',
        game.is_public
            ? '`Public ✅` — Players can use `/join-game`'
            : '`Draft ❌` — Not yet visible to players',
    ].join('\n');

    console.log('[buildGameStatTemplateEmbed] Final embed description:', embedDescription);

    const embed = new EmbedBuilder()
        .setTitle('📋 Current Stat Template')
        .setDescription(embedDescription)
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
