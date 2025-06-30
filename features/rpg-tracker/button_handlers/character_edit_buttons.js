// features/rpg-tracker/button_handlers/character_edit_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

/**
 * Handles character stat edit button interactions.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;
    if (!customId.startsWith('edit_stat:')) return;

    const [, characterId] = customId.split(':');
    const character = await getCharacterWithStats(characterId);

    const editableStats = (character.stats || []).filter(stat => {
        const name = (stat.name || '').toLowerCase();
        return !['name', 'avatar_url', 'bio', 'visibility'].includes(name);
    });

    if (!editableStats.length) {
        return await interaction.reply({
            content: '⚠️ This character has no editable stats defined.',
            ephemeral: true,
        });
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`editStatSelect:${characterId}`)
        .setPlaceholder('Select a stat to edit')
        .addOptions(
            editableStats.map(stat => ({
                label: stat.label || stat.name || 'Unnamed',
                value: stat.name,
                description: `Current value: ${stat.value}`,
            }))
        );

    const row = new ActionRowBuilder().addComponents(menu);

    return await interaction.reply({
        content: 'Select the stat you want to edit:',
        components: [row],
        ephemeral: true,
    });
}

module.exports = { handle };
