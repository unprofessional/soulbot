// features/rpg-tracker/components/view_paragraph_fields_button.js

const { ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCharacterWithStats } = require('../../../store/services/character.service');

const id = 'viewParagraphFields';

/**
 * Builds the button component
 */
function build(characterId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${characterId}`)
        .setLabel('📜 View Full Descriptions')
        .setStyle(ButtonStyle.Secondary);
}

/**
 * Handles the interaction
 */
async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');

    const character = await getCharacterWithStats(characterId);

    if (!character) {
        return await interaction.reply({
            content: '❌ Character not found.',
            ephemeral: true,
        });
    }

    // 🧠 Step 1: Include core paragraph fields (e.g., bio)
    const coreParagraphFields = [
        { label: 'Bio', value: character.bio },
        // Add more core paragraph fields here if needed
    ];

    const coreFormatted = coreParagraphFields
        .filter(f => f.value?.trim())
        .map(f => `**${f.label}**\n${f.value.trim()}`);

    // 🧠 Step 2: Include game-defined paragraph stats
    const statFormatted = (character.stats || [])
        .filter(stat => stat.field_type === 'paragraph' && stat.value?.trim())
        .map(stat => `**${stat.label}**\n${stat.value.trim()}`);

    // 🧠 Step 3: Combine them
    const paragraphStats = [...coreFormatted, ...statFormatted];

    if (!paragraphStats.length) {
        return await interaction.reply({
            content: 'ℹ️ No long-form descriptions available.',
            ephemeral: true,
        });
    }

    // ✂️ Discord message limit: split into ~1900 character chunks
    const chunks = [];
    let current = '';

    for (const block of paragraphStats) {
        if ((current + '\n\n' + block).length > 1900) {
            chunks.push(current);
            current = block;
        } else {
            current += (current ? '\n\n' : '') + block;
        }
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
        await interaction.followUp({
            content: chunk,
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
