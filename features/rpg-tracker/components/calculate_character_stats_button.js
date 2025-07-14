// features/rpg-tracker/components/calculate_character_stats_button.js

console.log('✅ Loading calculate_character_stats_button.js...');

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { isActiveCharacter } = require('../utils/is_active_character');
const { build: buildCharacterCard } = require('./view_character_card');

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
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const isSelf = await isActiveCharacter(userId, guildId, character.id);
        const view = buildCharacterCard(character, isSelf);

        return await interaction.update(view);
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
    const isSelf = await isActiveCharacter(userId, guildId, character.id);
    const base = buildCharacterCard(character, isSelf);

    return await interaction.update({
        ...base,
        content: '🧮 *Perform quick math on numeric stats using +, -, ×, or ÷.*',
        components: [dropdownRow, cancelRow],
    });
}

module.exports = { id, build, handle };
