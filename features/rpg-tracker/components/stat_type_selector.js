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
    const selectedType = interaction.isStringSelectMenu() ? interaction.values?.[0] : null;

    console.log('[stat_type_selector.handle] Interaction received:', {
        customId: interaction.customId,
        gameId,
        selectedType,
        rawValues: interaction.values,
    });

    if (!selectedType || !gameId) {
        console.warn('[stat_type_selector.handle] Missing gameId or selectedType:', {
            gameId,
            selectedType,
        });

        return interaction.reply({
            content: '⚠️ Invalid stat type selection.',
            ephemeral: true,
        });
    }

    console.log('[stat_type_selector.handle] Calling buildStatModal with:', {
        gameId,
        selectedType,
    });

    // console.log('>>> features/rpg-tracker/components/stat_type_selector.js > gameId: ', gameId);
    // console.log('>>> features/rpg-tracker/components/stat_type_selector.js > selectedType: ', selectedType);

    const modal = buildStatModal(gameId, selectedType);
    await interaction.showModal(modal);
}

module.exports = {
    id,
    build,
    handle,
};
