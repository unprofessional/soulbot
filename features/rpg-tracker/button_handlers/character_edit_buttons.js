// features/rpg-tracker/button_handlers/character_edit_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { renderCharacterView } = require('../utils/render_character_view');

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

            if (!character) {
                return await interaction.update({
                    content: '⚠️ Character not found.',
                    embeds: [],
                    components: [],
                });
            }

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
                    ...renderCharacterView(character),
                });
            }

            const dropdown = new StringSelectMenuBuilder()
                .setCustomId(`editCharacterStatDropdown:${characterId}`)
                .setPlaceholder('🛠️ Manually update a stat or core field')
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
                content: '🛠️ *Manually update a stat or core field by selecting it below.*',
                components: [dropdownRow, cancelRow],
            });

        }
    }
};
