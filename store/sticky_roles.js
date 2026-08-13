const { PermissionFlagsBits } = require('discord.js');
const StickyRoleDAO = require('./dao/sticky_role.dao.js');

const stickyRoleDAO = new StickyRoleDAO();

function roleBelongsToGuild(role, guild) {
    return Boolean(role && guild && (role.guild?.id || role.guildId) === guild.id);
}

function isRoleManageableByBot(role, guild) {
    if (!roleBelongsToGuild(role, guild)) return false;
    if (role.id === guild.id || role.managed) return false;

    const highestRole = guild.members?.me?.roles?.highest;
    if (!highestRole) return false;
    const botPermissions = guild.members?.me?.permissions;
    if (botPermissions && !botPermissions.has(PermissionFlagsBits.ManageRoles)) return false;
    if (role.editable === false) return false;

    if (typeof highestRole.comparePositionTo === 'function') {
        return highestRole.comparePositionTo(role) > 0;
    }
    return Number(highestRole.position) > Number(role.position);
}

async function assignStickyRole(guildMember, role) {
    const guild = guildMember.guild;
    if (guildMember.user.bot) return { ok: false, reason: 'bot' };
    if (!isRoleManageableByBot(role, guild)) {
        return { ok: false, reason: 'unmanageable' };
    }

    if (!guildMember.roles.cache.has(role.id)) {
        await guildMember.roles.add(role.id, 'Moderator assigned sticky role');
    }
    const added = await stickyRoleDAO.addAssignment(
        guild.id, guildMember.user.id, role.id
    );
    return { ok: true, added };
}

async function removeStickyRole(guildId, memberId, roleId) {
    return stickyRoleDAO.removeAssignment(
        String(guildId), String(memberId), String(roleId)
    );
}

async function getStickyRoleIds(guildId, memberId) {
    return stickyRoleDAO.getAssignments(String(guildId), String(memberId));
}

async function restoreStickyRoles(guildMember) {
    if (guildMember.user.bot) return [];

    const guild = guildMember.guild;
    const roleIds = await getStickyRoleIds(guild.id, guildMember.user.id);
    const restorableRoleIds = roleIds.filter((roleId) => {
        const role = guild.roles.cache.get(roleId);
        return isRoleManageableByBot(role, guild);
    });

    if (restorableRoleIds.length > 0) {
        await guildMember.roles.add(restorableRoleIds, 'Restoring moderator-assigned sticky roles');
    }
    return restorableRoleIds;
}

module.exports = {
    assignStickyRole,
    getStickyRoleIds,
    isRoleManageableByBot,
    removeStickyRole,
    restoreStickyRoles,
    roleBelongsToGuild,
};
