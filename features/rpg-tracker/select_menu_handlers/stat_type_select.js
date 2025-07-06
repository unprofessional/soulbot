const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

module.exports = {
    customIdPrefix: 'selectStatType:',

    /**
     * Handles stat type selection → launches modal
     * @param {import('discord.js').StringSelectMenuInteraction} interaction
     */
    async handle(interaction) {
        const [, gameId] = interaction.customId.split(':');
        const selectedType = interaction.values?.[0];

        if (!selectedType || !gameId) {
            return await interaction.reply({
                content: '⚠️ Invalid stat type selection.',
                ephemeral: true,
            });
        }

        const labelInput = new TextInputBuilder()
            .setCustomId('label')
            .setLabel('Field Label: What\'s it called?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const defaultInput = new TextInputBuilder()
            .setCustomId('default_value')
            .setLabel('Default Value (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const sortInput = new TextInputBuilder()
            .setCustomId('sort_index')
            .setLabel('Sort Order (optional): 0=top, 9=lower')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const modal = new ModalBuilder()
            .setCustomId(`createStatModal:${gameId}:${selectedType}`)
            .setTitle(`Add ${selectedType.replace('-', ' ')} stat`)
            .addComponents(
                new ActionRowBuilder().addComponents(labelInput),
                new ActionRowBuilder().addComponents(defaultInput),
                new ActionRowBuilder().addComponents(sortInput)
            );

        await interaction.showModal(modal);
    },
};
