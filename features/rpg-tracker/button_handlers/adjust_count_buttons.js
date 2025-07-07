// features/rpg-tracker/button_handlers/adjust_count_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getCharacterWithStats,
} = require('../../../store/services/character.service');

const { renderCharacterView } = require('../utils/render_character_view');

async function handle(interaction) {
    const { customId } = interaction;

    // === Adjust Stats Entry Button ===
    if (customId.startsWith('adjust_stats:')) {
        const [, characterId] = customId.split(':');
        const character = await getCharacterWithStats(characterId);
        if (!character) {
            return await interaction.update({
                content: '⚠️ Character not found.',
                embeds: [],
                components: [],
            });
        }

        const adjustableStats = character.stats.filter(
            s => s.field_type === 'count' || s.field_type === 'number'
        );

        if (!adjustableStats.length) {
            return await interaction.update(renderCharacterView(character));
        }

        const options = adjustableStats.map(stat => {
            const label = stat.label;
            const value = `adjust:${stat.template_id}`;

            const desc = stat.field_type === 'count'
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
}

module.exports = { handle };
