const { SlashCommandBuilder } = require('discord.js');
const { addGuild, getGuilds, removeGuild, guildIsSupported } = require('../../store/guilds.js');
const { addMember, getMembers, nickNameIsAlreadySet } = require('../../store/members.js');
const { toggleTwitter } = require('../../store/features.js');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';

function formatCodeList(items) {
    return items.map(item => `- \`${item}\``).join('\n');
}

function assertOwner(interaction) {
    if (interaction.user.id !== BOT_OWNER_ID) {
        return interaction.reply({
            content: 'You do not have permission to use this command.',
            ephemeral: true,
        });
    }

    return null;
}

async function assertSupportedGuild(interaction) {
    if (!(await guildIsSupported(interaction.guildId))) {
        return interaction.reply({
            content: 'Server not supported!!',
            ephemeral: true,
        });
    }

    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Owner-only maintenance commands.')
        .setDMPermission(false)
        .addSubcommandGroup(group =>
            group
                .setName('server')
                .setDescription('Manage supported servers.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('init')
                        .setDescription('Add this server to the supported list.')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('delete')
                        .setDescription('Remove this server from the supported list.')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List supported servers.')
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('feature')
                .setDescription('Toggle legacy features.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('toggle')
                        .setDescription('Toggle a feature on or off.')
                        .addStringOption(option =>
                            option
                                .setName('name')
                                .setDescription('Feature name to toggle.')
                                .setRequired(true)
                                .addChoices({
                                    name: 'twitter',
                                    value: 'twitter',
                                })
                        )
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('nick')
                .setDescription('Manage controlled nicknames.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a nickname prefix to a user and track it.')
                        .addUserOption(option =>
                            option
                                .setName('user')
                                .setDescription('The user whose nickname should be prefixed.')
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option
                                .setName('prefix')
                                .setDescription('The bracketed prefix to apply, without brackets.')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List controlled users.')
                )
        ),

    async execute(interaction) {
        const denied = await assertOwner(interaction);
        if (denied) return denied;

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (group === 'server' && subcommand === 'init') {
            const result = await addGuild(interaction.guildId);
            return interaction.reply({
                content: result.message,
                ephemeral: true,
            });
        }

        if (group === 'feature' && subcommand === 'toggle') {
            const featureName = interaction.options.getString('name');

            if (featureName !== 'twitter') {
                return interaction.reply({
                    content: 'Unknown feature.',
                    ephemeral: true,
                });
            }

            const result = await toggleTwitter();
            return interaction.reply({
                content: result.message,
                ephemeral: true,
            });
        }

        const unsupported = await assertSupportedGuild(interaction);
        if (unsupported) return unsupported;

        if (group === 'server' && subcommand === 'delete') {
            const result = await removeGuild(interaction.guildId);
            return interaction.reply({
                content: result.message,
                ephemeral: true,
            });
        }

        if (group === 'server' && subcommand === 'list') {
            const guildNames = await getGuilds(interaction.client);
            return interaction.reply({
                content: guildNames.length > 0
                    ? `Current supported servers:\n${formatCodeList(guildNames)}`
                    : 'List is empty for now...',
                ephemeral: true,
            });
        }

        if (group === 'nick' && subcommand === 'add') {
            const user = interaction.options.getUser('user');
            const prefix = interaction.options.getString('prefix').trim();

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                return interaction.reply({
                    content: 'There was a problem trying to find that member in this server.',
                    ephemeral: true,
                });
            }

            const nickname = member.nickname || user.username;
            if (nickNameIsAlreadySet(nickname, prefix)) {
                return interaction.reply({
                    content: 'That nickname already has this prefix.',
                    ephemeral: true,
                });
            }

            const newName = `[${prefix}] ${nickname}`.substring(0, 31);

            try {
                await member.setNickname(newName);
            } catch (error) {
                console.error('Failed to set nickname:', error);
                return interaction.reply({
                    content: 'There was a problem trying to set the nickname for this user!',
                    ephemeral: true,
                });
            }

            const result = await addMember(user, prefix);
            return interaction.reply({
                content: result.ok
                    ? `${result.message}\nUpdated nickname to \`${newName}\`.`
                    : result.message,
                ephemeral: true,
            });
        }

        if (group === 'nick' && subcommand === 'list') {
            const members = await getMembers(interaction.client, interaction.guildId);
            return interaction.reply({
                content: members.length > 0
                    ? `Current controlled users:\n${formatCodeList(members)}`
                    : 'List is empty for now...',
                ephemeral: true,
            });
        }

        return interaction.reply({
            content: 'Unknown admin command.',
            ephemeral: true,
        });
    },
};
