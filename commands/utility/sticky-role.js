const {
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');
const {
    assignStickyRole,
    getStickyRoleIds,
    removeStickyRole,
} = require('../../store/sticky_roles.js');

function hasManageRoles(interaction) {
    return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles));
}

function addUserOption(subcommand) {
    return subcommand.addUserOption(option => option
        .setName('user')
        .setDescription('The member whose sticky roles are being configured.')
        .setRequired(true));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky-role')
        .setDescription('Assign roles that Soulbot restores for specific members.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand => addUserOption(subcommand
            .setName('add')
            .setDescription('Assign a sticky role to a member.'))
            .addRoleOption(option => option
                .setName('role')
                .setDescription('The role to assign and make sticky.')
                .setRequired(true)))
        .addSubcommand(subcommand => addUserOption(subcommand
            .setName('remove')
            .setDescription('Stop restoring a role for a member.'))
            .addRoleOption(option => option
                .setName('role')
                .setDescription('The role to stop restoring.')
                .setRequired(true)))
        .addSubcommand(subcommand => addUserOption(subcommand
            .setName('list')
            .setDescription('List a member\'s sticky roles.'))),

    async execute(interaction) {
        if (!hasManageRoles(interaction)) {
            return interaction.reply({
                content: 'You need the Manage Roles permission to configure sticky roles.',
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return interaction.reply({
                content: 'That user is not currently a member of this server.',
                ephemeral: true,
            });
        }
        if (user.bot) {
            return interaction.reply({
                content: 'Sticky roles cannot be assigned to bots.',
                ephemeral: true,
            });
        }

        if (subcommand === 'add' || subcommand === 'remove') {
            const role = interaction.options.getRole('role', true);
            if ((role.guild?.id || role.guildId) !== interaction.guildId) {
                return interaction.reply({
                    content: 'That role must belong to this server.',
                    ephemeral: true,
                });
            }

            if (subcommand === 'add') {
                const result = await assignStickyRole(member, role);
                if (!result.ok) {
                    return interaction.reply({
                        content: 'Soulbot cannot manage that role. Choose a normal role below Soulbot\'s highest role.',
                        ephemeral: true,
                    });
                }
                return interaction.reply({
                    content: result.added
                        ? `${role} is now sticky for <@${user.id}>.`
                        : `${role} is already sticky for <@${user.id}>.`,
                    ephemeral: true,
                    allowedMentions: { parse: [] },
                });
            }

            const removed = await removeStickyRole(interaction.guildId, user.id, role.id);
            return interaction.reply({
                content: removed
                    ? `${role} will no longer be restored for <@${user.id}>. Their current role is unchanged.`
                    : `${role} was not sticky for <@${user.id}>.`,
                ephemeral: true,
                allowedMentions: { parse: [] },
            });
        }

        if (subcommand === 'list') {
            const roleIds = await getStickyRoleIds(interaction.guildId, user.id);
            if (roleIds.length === 0) {
                return interaction.reply({
                    content: `<@${user.id}> has no sticky roles configured.`,
                    ephemeral: true,
                    allowedMentions: { parse: [] },
                });
            }

            const roles = roleIds.map((roleId) => (
                interaction.guild.roles.cache.has(roleId)
                    ? `<@&${roleId}>`
                    : `Deleted role (${roleId})`
            ));
            return interaction.reply({
                content: `Sticky roles for <@${user.id}>:\n${roles.map(role => `- ${role}`).join('\n')}`,
                ephemeral: true,
                allowedMentions: { parse: [] },
            });
        }

        return interaction.reply({ content: 'Unknown sticky-role command.', ephemeral: true });
    },

    hasManageRoles,
};
