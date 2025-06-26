// commands/global/rpg-tracker/edit-game.js

const {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
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

            const options = templates.map((t, i) => ({
                label: `${i + 1}. ${t.label}`,
                description: `Type: ${t.field_type} — Default: ${t.default_value || 'None'}`,
                value: `${t.id}`,
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('selectStatField')
                .setPlaceholder('Select a field to edit')
                .addOptions(options);

            const actionRow = new ActionRowBuilder().addComponents(selectMenu);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('moveStatFieldUp')
                    .setLabel('⬆️ Move Up')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('moveStatFieldDown')
                    .setLabel('⬇️ Move Down')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('editStatField')
                    .setLabel('📝 Edit')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('deleteStatField')
                    .setLabel('🗑️ Delete')
                    .setStyle(ButtonStyle.Danger)
            );

            const globalButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`editGameModal:${game.id}`)
                    .setLabel('⚙️ Edit Game Details')
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

            const summaryLines = templates.map((f, i) => `${i + 1}. ${f.label} (${f.field_type}${f.default_value ? `, default: ${f.default_value}` : ''})`);

            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Editing stat template for ${game.name}`)
                .setDescription('_Select a field from the dropdown below, then use a button to modify it._')
                .addFields({ name: 'Current Fields', value: summaryLines.join('\n') || '_No fields defined yet._' });

            return await interaction.reply({
                content: `📋 Total Fields: ${templates.length}`,
                embeds: [embed],
                components: [actionRow, buttons, globalButtons],
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
