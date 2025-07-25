// commands/global/rpg-tracker/create-game.js

const { SlashCommandBuilder, ActionRowBuilder } = require('discord.js');
const { createGame } = require('../../../store/services/game.service');
const { getOrCreatePlayer, setCurrentGame } = require('../../../store/services/player.service');
const { build: buildDefineStatsButton } = require('../../../features/rpg-tracker/components/define_stats_button');
const { build: buildTogglePublishButton } = require('../../../features/rpg-tracker/components/toggle_publish_button');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-game')
        .setDescription('Creates a new RPG campaign for this server.')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('The name of your game/campaign')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('A short description of the game')
                .setRequired(false)
        ),

    async execute(interaction) {
        const name = interaction.options.getString('name')?.trim();
        const description = interaction.options.getString('description')?.trim() || null;
        const guildId = interaction.guild?.id;
        const userId = interaction.user.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used within a server.',
                ephemeral: true,
            });
        }

        try {
            const game = await createGame({
                name,
                description,
                createdBy: userId,
                guildId,
            });

            await getOrCreatePlayer(userId, guildId, 'gm');
            await setCurrentGame(userId, guildId, game.id);

            const defineStatsBtn = buildDefineStatsButton(game.id);
            const publishBtn = buildTogglePublishButton(game.id);

            const row = new ActionRowBuilder().addComponents(defineStatsBtn, publishBtn);

            await interaction.reply({
                content: [
                    `# **${game.name}**`,
                    `✅ Created game and set it as your active campaign.`,
                    ``,
                    `**Character Stat Fields:**`,
                    ` - 🟦 **System Fields** (always included):`,
                    `  - Name`,
                    `  - Avatar URL`,
                    `  - Bio`,
                    ``,
                    ` - 🟨 **Game Fields** (you define these)`,
                    `  - Ex: HP, Strength, Skills, etc.`,
                    ``,
                    `Use the buttons below to define your required game-specific stat fields or to publish the game.`,
                    `_You do **not** need to redefine system fields._`,
                ].join('\n'),
                components: [row],
                ephemeral: true,
            });

        } catch (err) {
            console.error('[COMMAND ERROR] /create-game:', err);
            await interaction.reply({
                content: '❌ Failed to create game. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
