const {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');
const {
    clearGreetingChannelId,
    getGreetingChannelId,
    setGreetingChannelId,
} = require('../../store/guilds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('greeting')
        .setDescription('Configure welcome and goodbye announcements for this server.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Register the channel used for welcome and goodbye announcements.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to use for member join/leave announcements.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Disable welcome and goodbye announcements for this server.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show the current greeting channel configuration for this server.')
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

            await setGreetingChannelId(interaction.guildId, channel.id);
            return interaction.reply({
                content: `Greeting announcements will now be posted in ${channel}.`,
                ephemeral: true,
            });
        }

        if (subcommand === 'clear') {
            await clearGreetingChannelId(interaction.guildId);
            return interaction.reply({
                content: 'Greeting announcements are now disabled for this server.',
                ephemeral: true,
            });
        }

        if (subcommand === 'status') {
            const channelId = await getGreetingChannelId(interaction.guildId);
            return interaction.reply({
                content: channelId
                    ? `Greeting announcements are currently set to <#${channelId}>.`
                    : 'Greeting announcements are currently disabled for this server.',
                ephemeral: true,
            });
        }

        return interaction.reply({
            content: 'Unknown greeting command.',
            ephemeral: true,
        });
    },
};
