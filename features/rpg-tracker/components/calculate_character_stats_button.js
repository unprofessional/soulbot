// features/rpg-tracker/components/calculate_character_stats_button.js

console.log('✅ Loading calculate_character_stats_button.js...');

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { renderCharacterView } = require('../utils/render_character_view');

console.log('✅ Loaded calculate_character_stats_button.js correctly');

const id = 'calculateCharacterStats';

/**
 * Builds the "🧮 Calc Stats" button.
 * @param {string} characterId
 * @returns {ButtonBuilder}
 */
function build(characterId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${characterId}`)
        .setLabel('🧮 Calc Stats')
        .setStyle(ButtonStyle.Secondary);
}

/**
 * Handles the button interaction to adjust numeric character stats.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');

    const character = await getCharacterWithStats(characterId);
    if (!character) {
        return await interaction.update({
            content: '⚠️ Character not found.',
            embeds: [],
            components: [],
        });
    }

    const adjustableStats = (character.stats || []).filter(
        s => s.field_type === 'count' || s.field_type === 'number'
    );

    if (!adjustableStats.length) {
        return await interaction.update(await renderCharacterView(character));
    }

    const options = adjustableStats.map(stat => {
        const label = stat.label;
        const value = `adjust:${stat.template_id}`;
        const desc =
            stat.field_type === 'count'
                ? `Current: ${stat.meta?.current ?? stat.meta?.max ?? 0} / ${stat.meta?.max ?? '?'}`
                : `Current: ${stat.value ?? '??'}`;

        return {
            label,
            value,
            description: desc,
        };
    });

    const dropdown = new StringSelectMenuBuilder()
        .setCustomId(`adjustStatSelect:${characterId}`)
        .setPlaceholder('🧮 Do quick math on numeric stats (+, -, ×, ÷)')
        .addOptions(options);

    const dropdownRow = new ActionRowBuilder().addComponents(dropdown);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`goBackToCharacter:${characterId}`)
        .setLabel('↩️ Cancel / Go Back')
        .setStyle(ButtonStyle.Secondary);

    const cancelRow = new ActionRowBuilder().addComponents(cancelButton);

    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const base = await renderCharacterView(character, { userId, guildId });

    return await interaction.update({
        ...base,
        content: '🧮 *Perform quick math on numeric stats using +, -, ×, or ÷.*',
        components: [dropdownRow, cancelRow],
    });
}

module.exports = { id, build, handle };
