// commands/global/rpg-tracker/edit-game.js

// commands/global/rpg-tracker/edit-game.js

const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getCurrentGame } = require('../../../store/services/player.service');
const { getGame } = require('../../../store/services/game.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-game')
        .setDescription('Edit your currently active game’s name or description.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        if (!guildId) {
            return interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        try {
            const gameId = await getCurrentGame(userId);
            const game = await getGame({ id: gameId });

            if (!game || game.created_by !== userId) {
                return interaction.reply({
                    content: '⚠️ You must be the GM of an active game to edit it.',
                    ephemeral: true,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`editGameModal:${game.id}`)
                .setTitle('Edit Game Info')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel('Game Name')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setValue(game.name)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('description')
                            .setLabel('Description (optional)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                            .setValue(game.description || '')
                    )
                );

            await interaction.showModal(modal);
        } catch (err) {
            console.error('[COMMAND ERROR] /edit-game:', err);
            await interaction.reply({
                content: '❌ Failed to load game editor.',
                ephemeral: true,
            });
        }
    },
};
