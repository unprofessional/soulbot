// features/rpg-tracker/components/edit_character_stats_button.js

console.log('✅ Loading edit_character_stats_button.js...');

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { isActiveCharacter } = require('../utils/is_active_character');

console.log('✅ Loaded edit_character_stats_button.js correctly');

const id = 'editCharacterStat';

/**
 * Builds the 'Edit Stats' button for character action rows.
 * @param {string} characterId
 * @returns {ButtonBuilder}
 */
function build(characterId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${characterId}`)
        .setLabel('✏️ Update Stats')
        .setStyle(ButtonStyle.Primary);
}

/**
 * Handles the 'Edit Stats' button interaction.
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

    const truncate = (str, max = 100) =>
        str?.length > max ? str.slice(0, max - 1) + '…' : str;

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

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const isSelf = await isActiveCharacter(userId, guildId, character.id);

    const { build: buildCharacterCard } = require('./view_character_card');
    const base = await buildCharacterCard(character, { viewerUserId: isSelf ? userId : null });

    if (options.length === 0) {
        return await interaction.update({
            content: '⚠️ No editable fields found.',
            ...base,
        });
    }

    const dropdown = new StringSelectMenuBuilder()
        .setCustomId(`editCharacterStatDropdown:${characterId}`)
        .setPlaceholder('🛠️ Manually update a stat or core field')
        .addOptions(options);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`goBackToCharacter:${characterId}`)
        .setLabel('↩️ Cancel / Go Back')
        .setStyle(ButtonStyle.Secondary);

    const dropdownRow = new ActionRowBuilder().addComponents(dropdown);
    const cancelRow = new ActionRowBuilder().addComponents(cancelButton);

    return await interaction.update({
        ...base,
        content: '🛠️ *Manually update a stat or core field by selecting it below.*',
        components: [dropdownRow, cancelRow],
    });
}

module.exports = { id, build, handle };
