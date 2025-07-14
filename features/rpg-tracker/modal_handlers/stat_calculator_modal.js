// features/rpg-tracker/modal_handlers/stat_calculator_modal.js

const {
    getCharacterWithStats,
    updateStat,
    updateStatMetaField,
} = require('../../../store/services/character.service');

const { isActiveCharacter } = require('../utils/is_active_character');
const { build: buildCharacterCard } = require('../components/view_character_card');

/**
 * Handles modal for adjusting stats (add/subtract/multiply/divide flow).
 * @param {import('discord.js').ModalSubmitInteraction} interaction 
 */
async function handle(interaction) {
    const { customId } = interaction;
    if (!customId.startsWith('adjustStatModal:')) return;

    const [, characterId, statId] = customId.split(':');
    const operator = interaction.fields.getTextInputValue('deltaOperator')?.trim();
    const valueRaw = interaction.fields.getTextInputValue('deltaValue')?.trim();
    const value = parseInt(valueRaw, 10);

    if (!['+', '-', '*', '/'].includes(operator)) {
        return await interaction.reply({
            content: '⚠️ Invalid operator. Use one of: +, -, *, /',
            ephemeral: true,
        });
    }

    if (isNaN(value)) {
        return await interaction.reply({
            content: '⚠️ Invalid number entered.',
            ephemeral: true,
        });
    }

    const character = await getCharacterWithStats(characterId);
    const stat = character.stats.find(s => s.template_id === statId);

    if (!stat) {
        return await interaction.reply({
            content: `⚠️ Stat not found.`,
            ephemeral: true,
        });
    }

    let current;
    if (stat.field_type === 'count') {
        current = parseInt(stat.meta?.current ?? stat.meta?.max ?? 0);
    } else if (stat.field_type === 'number') {
        current = parseInt(stat.value ?? 0);
    } else {
        return await interaction.reply({
            content: `⚠️ Cannot adjust stat of type: ${stat.field_type}`,
            ephemeral: true,
        });
    }

    let next;
    switch (operator) {
    case '+': next = current + value; break;
    case '-': next = current - value; break;
    case '*': next = current * value; break;
    case '/': next = value === 0 ? current : Math.floor(current / value); break;
    }

    if (stat.field_type === 'count') {
        await updateStatMetaField(characterId, statId, 'current', next);
    } else {
        await updateStat(characterId, statId, String(next));
    }

    const updated = await getCharacterWithStats(characterId);
    const isSelf = await isActiveCharacter(interaction.user.id, interaction.guildId, characterId);

    const view = buildCharacterCard(updated, {
        viewerUserId: isSelf ? interaction.user.id : null,
    });

    return await interaction.update({
        ...view,
        content: `✅ Updated **${stat.label}**: ${current} ${operator} ${value} → ${next}`,
        ephemeral: true,
    });
}

module.exports = { handle };
