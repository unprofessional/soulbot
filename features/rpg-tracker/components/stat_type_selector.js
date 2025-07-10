// features/rpg-tracker/components/stat_type_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { build: buildStatModal } = require('./create_stat_modal');

const id = 'selectStatType';

function build(gameId) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setPlaceholder('➕ Add a new stat field...')
        .addOptions([
            {
                label: 'Number (ex. Level, EXP, Gold)',
                value: 'number',
                emoji: '🔢',
            },
            {
                label: 'Count (ex. HP, MP — current/max)',
                value: 'count',
                emoji: '🔁',
            },
            {
                label: 'Short Text (one-line)',
                value: 'short',
                emoji: '💬',
            },
            {
                label: 'Paragraph Text (multi-line)',
                value: 'paragraph',
                emoji: '📝',
            },
        ]);

    return new ActionRowBuilder().addComponents(select);
}

async function handle(interaction) {
    const [, gameId] = interaction.customId.split(':');
    // const selectedType = interaction.values?.[0]; // old way
    const selectedType = interaction.isStringSelectMenu() ? interaction.values?.[0] : null; // new check

    console.log('[stat_type_selector] Received:', {
        customId: interaction.customId,
        selectedType,
        values: interaction.values,
    });

    if (!selectedType || !gameId) {
        return interaction.reply({
            content: '⚠️ Invalid stat type selection.',
            ephemeral: true,
        });
    }

    const modal = buildStatModal(gameId, selectedType);
    console.log('[stat_type_selector] Calling buildStatModal with:', { gameId, selectedType });
    await interaction.showModal(modal);
}

module.exports = {
    id,
    build,
    handle,
};
