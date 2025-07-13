// features/rpg-tracker/components/view_character_card.js

const { EmbedBuilder, ActionRowBuilder } = require('discord.js');

const { build: buildEditCharacterStatsButton } = require('./edit_character_stats_button');
const { build: buildToggleCharacterVisibilityButton } = require('./toggle_character_visibility_button');
const { build: buildDeleteCharacterButton } = require('./delete_character_button');

const { formatTimeAgo } = require('../utils/time_ago');

/**
 * Build full character view response (content, embeds, buttons).
 * @param {Object} character - Character object
 * @param {Object} opts - Optional config
 * @param {string} opts.viewerUserId - Current viewer user ID
 * @returns {Object} Discord-compatible response
 */
function build(character, { viewerUserId = null } = {}) {
    const isSelf = character.created_by === viewerUserId;

    const content = buildContent(character, isSelf);
    const embed = buildEmbed(character);
    const components = isSelf ? [buildButtons(character)] : [];

    return {
        content,
        embeds: [embed],
        components,
    };
}

function buildContent(character, isSelf) {
    const lines = [`# **${character.name || 'Unnamed Character'}**`];

    if (character.bio?.trim()) {
        const bio = character.bio.trim().slice(0, 200);
        lines.push(`> ${bio}${character.bio.length > 200 ? '…' : ''}`);
    }

    lines.push('');
    lines.push('🧬 **Core Stats:**');
    lines.push('- Name');
    lines.push('- Avatar URL');
    lines.push('- Bio');
    lines.push('');

    if (character.stats?.length) {
        lines.push('🎯 **Game Fields:**');
        for (const stat of character.stats) {
            const label = stat.label || stat.name || stat.template_id || 'Unnamed';
            const type = stat.field_type || '?';
            lines.push(`- ${label} \`${type}\``);
        }
    } else {
        lines.push('🎯 **Game Fields:** _None set yet._');
    }

    lines.push('');
    lines.push(isSelf
        ? 'Use the buttons below to edit or publish this character.'
        : 'Only the character owner can modify or publish this profile.');

    return lines.join('\n');
}

function buildEmbed(character) {
    const embed = new EmbedBuilder();

    embed.setTitle(character.name || 'Unnamed Character');

    if (character.avatar_url) {
        embed.setImage(character.avatar_url);
    }

    if (character.bio) {
        embed.setDescription(`_${character.bio}_`);
    }

    const createdAt = new Date(character.created_at);
    const createdAgo = formatTimeAgo(character.created_at);

    const isPublic = (character.visibility || 'private').toLowerCase() === 'public';
    const visibilityStr = isPublic
        ? '`🌐 Public` — Visible to others'
        : '`🔒 Private` — Only visible to you';

    embed.addFields(
        { name: 'Visibility', value: visibilityStr, inline: true },
        {
            name: 'Created',
            value: `${createdAt.toLocaleDateString()} (${createdAgo})`,
            inline: true,
        }
    );

    return embed;
}

function buildButtons(character) {
    const row = new ActionRowBuilder().addComponents(
        buildEditCharacterStatsButton(character.id),
        buildToggleCharacterVisibilityButton(character.id, character.visibility),
        buildDeleteCharacterButton(character.id)
    );

    return row;
}

module.exports = { build };
