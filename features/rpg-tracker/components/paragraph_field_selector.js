// features/rpg-tracker/components/paragraph_field_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { getCharacterWithStats } = require('../../../store/services/character.service');

const id = 'paragraphFieldSelect';

function truncate(str, max = 100) {
    if (!str) return undefined;
    const cleaned = str.trim().replace(/\s+/g, ' ');
    return cleaned.length > max ? cleaned.slice(0, max - 1) + '…' : cleaned;
}

/**
 * Builds the paragraph field select menu.
 */
function build(character) {
    const options = [];

    if (character.bio?.trim()) {
        options.push({
            label: 'Bio',
            value: 'core:bio',
            description: truncate(character.bio),
        });
    }

    for (const stat of character.stats || []) {
        if (stat.field_type === 'paragraph' && stat.value?.trim()) {
            options.push({
                label: stat.label,
                value: `game:${stat.template_id}`,
                description: truncate(stat.value),
            });
        }
    }

    if (!options.length) return null;

    const dropdown = new StringSelectMenuBuilder()
        .setCustomId(`${id}:${character.id}`)
        .setPlaceholder('📜 Select a paragraph field to view')
        .addOptions(options.filter(Boolean)); // Ensure no malformed entries

    const row = new ActionRowBuilder().addComponents(dropdown);
    return row;
}

/**
 * Handles dropdown selection of paragraph fields.
 */
async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');
    const selected = interaction.values?.[0];

    const character = await getCharacterWithStats(characterId);
    if (!character || !selected) {
        return await interaction.reply({
            content: '❌ Unable to load character or field.',
            ephemeral: true,
        });
    }

    let label = '(unknown)';
    let fullText = '';

    if (selected === 'core:bio') {
        label = 'Bio';
        fullText = character.bio || '';
    } else if (selected.startsWith('game:')) {
        const templateId = selected.split(':')[1];
        const stat = character.stats?.find(s => s.template_id === templateId);
        if (stat) {
            label = stat.label || stat.template_id;
            fullText = stat.value || '';
        }
    }

    if (!fullText.trim()) {
        return await interaction.reply({
            content: `ℹ️ No content available for **${label}**.`,
            ephemeral: true,
        });
    }

    // Chunk response for Discord
    const chunks = [];
    let current = '';
    for (const paragraph of fullText.split(/\n{2,}/)) {
        if ((current + '\n\n' + paragraph).length > 1900) {
            chunks.push(current);
            current = paragraph;
        } else {
            current += (current ? '\n\n' : '') + paragraph;
        }
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
        await interaction.followUp({
            content: `**${label}**\n\n${chunk}`,
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
