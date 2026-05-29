const {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');
const {
    clearBotAnnouncementChannelId,
    getBotAnnouncementChannelId,
    setBotAnnouncementChannelId,
} = require('../../store/guilds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-announcements')
        .setDescription('Configure operational bot announcements for this server.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Register the channel used for bot lifecycle announcements.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to use for bot restart and lifecycle notices.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Disable bot lifecycle announcements for this server.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show the current bot announcement channel for this server.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel', true);

            if (channel.guildId !== interaction.guildId) {
                return interaction.reply({
                    content: 'That channel must belong to this server.',
                    ephemeral: true,
                });
            }

            await setBotAnnouncementChannelId(interaction.guildId, channel.id);
            return interaction.reply({
                content: `Bot announcements will now be posted in ${channel}.`,
                ephemeral: true,
            });
        }

        if (subcommand === 'clear') {
            await clearBotAnnouncementChannelId(interaction.guildId);
            return interaction.reply({
                content: 'Bot announcements are now disabled for this server.',
                ephemeral: true,
            });
        }

        if (subcommand === 'status') {
            const channelId = await getBotAnnouncementChannelId(interaction.guildId);
            return interaction.reply({
                content: channelId
                    ? `Bot announcements are currently set to <#${channelId}>.`
                    : 'Bot announcements are currently disabled for this server.',
                ephemeral: true,
            });
        }

        return interaction.reply({
            content: 'Unknown bot announcements command.',
            ephemeral: true,
        });
    },
};
