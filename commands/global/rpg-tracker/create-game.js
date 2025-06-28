// commands/global/rpg-tracker/create-game.js

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { createGame } = require('../../../store/services/game.service');
const { getOrCreatePlayer, setCurrentGame } = require('../../../store/services/player.service');
const { persistInteractionContext } = require('../../../features/rpg-tracker/utils/context_utils');

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
        const discordUserId = interaction.user.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used within a server.',
                ephemeral: true,
            });
        }

        try {
            // Create game record
            const game = await createGame({
                name,
                description,
                createdBy: discordUserId,
                guildId,
            });

            // Ensure global player + per-server link (GM role)
            const playerLink = await getOrCreatePlayer(discordUserId, guildId, 'gm');

            // Set current game for this player in this guild
            await setCurrentGame(discordUserId, guildId, game.id);

            // Build response UI
            const defineStatsBtn = new ButtonBuilder()
                .setCustomId(`defineStats:${game.id}`)
                .setLabel('Define Required Stats')
                .setStyle(ButtonStyle.Primary);

            const publishBtn = new ButtonBuilder()
                .setCustomId(`publishGame:${game.id}`)
                .setLabel('📣 Publish Game')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(defineStatsBtn, publishBtn);

            // Send response and capture message for context tracking
            const reply = await interaction.reply({
                content: [
                    `✅ Created game **${game.name}** and set it as your active campaign.`,
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
                fetchReply: true,
            });

            // Persist interaction context using actual player_id from player table
            await persistInteractionContext(playerLink.player_id, game.id, reply.id);

        } catch (err) {
            console.error('[COMMAND ERROR] /create-game:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Failed to create game. Please try again later.',
                    ephemeral: true,
                });
            }
        }
    },
};
