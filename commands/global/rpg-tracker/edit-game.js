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

            // Build embeds (max 10 per message, Discord limit)
            const embeds = templates.slice(0, 10).map((f, index) => {
                const icon = f.field_type === 'paragraph' ? '📝' : '🔹';
                const defaultVal = f.default_value ? ` _(default: ${f.default_value})_` : '';
                return new EmbedBuilder()
                    .setTitle(`${icon} ${f.label}`)
                    .setDescription(`Type: **${f.field_type}**${defaultVal}\nSort Order: ${f.sort_order}`)
                    .setColor(0x3498db)
                    .setFooter({ text: `Field ${index + 1} of ${templates.length}` });
            });

            // Only keep 5 components max (Discord API limit)
            const components = templates.slice(0, 5).map((f, index) => {
                const row = new ActionRowBuilder();

                if (index > 0) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`moveStatFieldUp:${f.id}`)
                            .setLabel('⬆️ Move Up')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }

                if (index < templates.length - 1) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`moveStatFieldDown:${f.id}`)
                            .setLabel('⬇️ Move Down')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`deleteStatField:${f.id}`)
                        .setLabel('🗑️ Delete')
                        .setStyle(ButtonStyle.Danger)
                );

                return row;
            });

            // Final controls row (always present)
            const globalButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`editGameModal:${game.id}`)
                    .setLabel('📝 Edit Game Details')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`defineStats:${game.id}`)
                    .setLabel('➕ Add Required Stat')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`finishStatSetup:${game.id}`)
                    .setLabel('✅ Done')
                    .setStyle(ButtonStyle.Success)
            );

            const limitedComponents = components.slice(0, 4); // up to 4 rows
            limitedComponents.push(globalButtons); // final row is 5th max

            return await interaction.reply({
                content: `⚙️ Editing stat template for **${game.name}**. Use buttons below each field.`,
                embeds: embeds,
                components: limitedComponents,
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
