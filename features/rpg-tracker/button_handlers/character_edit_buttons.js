// features/rpg-tracker/button_handlers/character_edit_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

// Utility to safely truncate long descriptions (max 100 characters)
function truncate(str, max = 100) {
    return str?.length > max ? str.slice(0, max - 1) + '…' : str;
}

module.exports = {
    async handle(interaction) {
        const { customId } = interaction;

        if (customId.startsWith('edit_stat:')) {
            const [, characterId] = customId.split(':');
            const character = await getCharacterWithStats(characterId);

            const coreFields = [
                { value: 'core:name', label: 'Name', type: 'short', current: character.name },
                { value: 'core:avatar_url', label: 'Avatar URL', type: 'short', current: character.avatar_url },
                { value: 'core:bio', label: 'Bio', type: 'paragraph', current: character.bio },
                { value: 'core:visibility', label: 'Visibility', type: 'short', current: character.visibility },
            ];

            const editableStats = (character.stats || []).filter(stat => {
                const name = (stat.name || '').toLowerCase();
                return !['name', 'avatar_url', 'bio', 'visibility'].includes(name);
            });

            const statOptions = editableStats
                .filter(stat =>
                    (typeof stat.template_id === 'string' && stat.template_id.trim()) ||
                    (typeof stat.name === 'string' && stat.name.trim())
                )
                .map(stat => {
                    const identifier = stat.template_id || stat.name;
                    return {
                        label: String(stat.label || identifier || 'Unnamed'),
                        value: String(identifier),
                        description: stat.value != null
                            ? truncate(`Current: ${stat.value}`)
                            : 'No value set',
                    };
                });

            const coreOptions = coreFields.map(field => ({
                label: `[CORE] ${field.label}`,
                value: field.value,
                description: field.current
                    ? truncate(`Current: ${field.current}`)
                    : 'No value set',
            }));

            const options = [...coreOptions, ...statOptions].slice(0, 25);

            if (options.length === 0) {
                return await interaction.update({
                    content: '⚠️ No editable fields found.',
                    components: [],
                });
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId(`editCharacterStatDropdown:${characterId}`)
                .setPlaceholder('Choose a stat or core field to edit')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(select);

            return await interaction.update({
                content: '🛠️ Select the stat or field you want to edit:',
                components: [row],
            });
        }
    }
};
