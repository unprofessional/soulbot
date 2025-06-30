// features/rpg-tracker/button_handlers/character_edit_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const {
    getCharacterWithStats,
} = require('../../../store/services/character.service');

module.exports = {
    async handle(interaction) {
        const { customId } = interaction;

        // === 🎲 Edit Stat Button Pressed ===
        if (customId.startsWith('edit_stat:')) {
            const [, characterId] = customId.split(':');
            const character = await getCharacterWithStats(characterId);

            const editableStats = (character.stats || []).filter(stat => {
                const name = (stat.name || '').toLowerCase();
                return !['name', 'avatar_url', 'bio', 'visibility'].includes(name);
            });

            const options = editableStats
                .filter(stat =>
                    (typeof stat.template_id === 'string' && stat.template_id.trim()) ||
        (typeof stat.name === 'string' && stat.name.trim())
                )
                .map(stat => {
                    const identifier = stat.name || stat.template_id;
                    return {
                        label: String(stat.label || identifier || 'Unnamed'),
                        value: String(identifier),
                        description: stat.value != null ? `Current: ${stat.value}` : 'No value set',
                    };
                })
                .slice(0, 25);

            if (options.length === 0) {
                console.warn('[Edit Stat] No valid options to display for character:', characterId, editableStats);
                return await interaction.reply({
                    content: '⚠️ No valid stats to edit.',
                    ephemeral: true,
                });
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId(`editStatSelect:${characterId}`)
                .setPlaceholder('Choose a stat to edit')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(select);

            return await interaction.reply({
                content: 'Select the stat you want to edit:',
                components: [row],
                ephemeral: true,
            });
        }
    }
};
