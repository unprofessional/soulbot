const {
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');
const {
    addStickyRole,
    getStickyRoleIds,
    removeStickyRole,
} = require('../../store/sticky_roles.js');

function hasManageRoles(interaction) {
    return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky-role')
        .setDescription('Configure roles Soulbot restores when members rejoin.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand => subcommand
            .setName('add')
            .setDescription('Remember and restore a role when members rejoin.')
            .addRoleOption(option => option
                .setName('role')
                .setDescription('The role to make sticky.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('remove')
            .setDescription('Stop remembering and restoring a role.')
            .addRoleOption(option => option
                .setName('role')
                .setDescription('The role to stop making sticky.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('list')
            .setDescription('List this server\'s configured sticky roles.')),

    async execute(interaction) {
        if (!hasManageRoles(interaction)) {
            return interaction.reply({
                content: 'You need the Manage Roles permission to configure sticky roles.',
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'add') {
            const role = interaction.options.getRole('role', true);
            if ((role.guild?.id || role.guildId) !== interaction.guildId) {
                return interaction.reply({
                    content: 'That role must belong to this server.',
                    ephemeral: true,
                });
            }

            const result = await addStickyRole(interaction.guild, role);
            if (!result.ok) {
                return interaction.reply({
                    content: 'Soulbot cannot manage that role. Choose a normal role below Soulbot\'s highest role.',
                    ephemeral: true,
                });
            }

            return interaction.reply({
                content: result.added
                    ? `${role} is now sticky.`
                    : `${role} is already sticky.`,
                ephemeral: true,
                allowedMentions: { parse: [] },
            });
        }

        if (subcommand === 'remove') {
            const role = interaction.options.getRole('role', true);
            if ((role.guild?.id || role.guildId) !== interaction.guildId) {
                return interaction.reply({
                    content: 'That role must belong to this server.',
                    ephemeral: true,
                });
            }

            const removed = await removeStickyRole(interaction.guildId, role.id);
            return interaction.reply({
                content: removed
                    ? `${role} is no longer sticky.`
                    : `${role} was not configured as sticky.`,
                ephemeral: true,
                allowedMentions: { parse: [] },
            });
        }

        if (subcommand === 'list') {
            const roleIds = await getStickyRoleIds(interaction.guildId);
            if (roleIds.length === 0) {
                return interaction.reply({
                    content: 'This server has no sticky roles configured.',
                    ephemeral: true,
                });
            }

            const roles = roleIds.map((roleId) => (
                interaction.guild.roles.cache.has(roleId)
                    ? `<@&${roleId}>`
                    : `Deleted role (${roleId})`
            ));
            return interaction.reply({
                content: `Sticky roles:\n${roles.map(role => `- ${role}`).join('\n')}`,
                ephemeral: true,
                allowedMentions: { parse: [] },
            });
        }

        return interaction.reply({
            content: 'Unknown sticky-role command.',
            ephemeral: true,
        });
    },

    hasManageRoles,
};
