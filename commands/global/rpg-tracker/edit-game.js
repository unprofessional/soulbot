// commands/global/rpg-tracker/edit-game.js

const {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    EmbedBuilder,
} = require('discord.js');

const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { getOrCreatePlayer } = require('../../../store/services/player.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-game')
        .setDescription('Edit the required stat template for your active game (GM only).'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        try {
            const player = await getOrCreatePlayer(userId);
            const gameId = player?.current_game_id;
            if (!gameId) {
                return await interaction.reply({
                    content: '⚠️ No active game found. Use `/create-game` or `/switch-game`.',
                    ephemeral: true,
                });
            }

            const game = await getGame({ id: gameId });
            if (!game || game.created_by !== userId) {
                return await interaction.reply({
                    content: '⚠️ Only the GM of a game can edit its stat template.',
                    ephemeral: true,
                });
            }

            const templates = await getStatTemplates(gameId);
            const rows = templates.map(f => {
                const icon = f.field_type === 'paragraph' ? '📝' : '🔹';
                const defaultVal = f.default_value ? ` _(default: ${f.default_value})_` : '';
                return `${icon} **${f.label}**${defaultVal}`;
            });

            const embed = new EmbedBuilder()
                .setTitle('📋 Current Stat Template')
                .setDescription(rows.length ? rows.join('\n') : '*No stat fields defined yet.*')
                .setColor(0x00b0f4);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`defineStats:${gameId}`)
                    .setLabel('➕ Add Another Stat')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`finishStatSetup:${gameId}`)
                    .setLabel('✅ Done')
                    .setStyle(ButtonStyle.Success)
            );

            return await interaction.reply({
                content: `⚙️ You can add or update stat fields for **${game.name}** below.`,
                embeds: [embed],
                components: [buttons],
                ephemeral: true,
            });

        } catch (err) {
            console.error('Error in /edit-game:', err);
            return await interaction.reply({
                content: '❌ Failed to edit game. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
