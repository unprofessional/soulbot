// features/rpg-tracker/components/view_game_card.js

const { EmbedBuilder, ActionRowBuilder } = require('discord.js');

const { build: buildDefineStats } = require('./define_stats_button');
const { build: buildEditStats } = require('./edit_stat_button');
const { build: buildDeleteStats } = require('./delete_stat_button');
const { build: buildToggleVisibility } = require('./toggle_publish_button');

function build(game, statTemplates = [], viewerUserId = null) {
    const isGM = !viewerUserId || game.created_by === viewerUserId;

    const content = buildContent(game, statTemplates, isGM);
    const embed = buildEmbed(game, statTemplates);
    const components = isGM ? [buildButtons(game.id, statTemplates)] : [];

    return {
        content,
        embeds: [embed],
        components,
    };
}

function buildContent(game, statTemplates, isGM) {
    const lines = [`# **${game.name}**`];

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
    lines.push(isGM
        ? `Use the buttons below to manage stat fields or update game info.`
        : `Ask your Game Master to edit stats or publish this game.`);

    return lines.join('\n');
}

function buildEmbed(game, fields, highlightLabel = null) {
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

function buildButtons(gameId, statTemplates = []) {
    const row = new ActionRowBuilder().addComponents(
        buildDefineStats(gameId)
    );

    if (statTemplates.length > 0) {
        row.addComponents(
            buildEditStats(gameId),
            buildDeleteStats(gameId)
        );
    }

    row.addComponents(
        buildToggleVisibility(gameId)
    );

    return row;
}

module.exports = { build };
