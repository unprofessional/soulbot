const StickyRoleDAO = require('./dao/sticky_role.dao.js');
const { PermissionFlagsBits } = require('discord.js');

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

async function addStickyRole(guild, role) {
    if (!isRoleManageableByBot(role, guild)) {
        return { ok: false, reason: 'unmanageable' };
    }

    const added = await stickyRoleDAO.addConfiguredRole(guild.id, role.id);
    return { ok: true, added };
}

async function removeStickyRole(guildId, roleId) {
    return stickyRoleDAO.removeConfiguredRole(String(guildId), String(roleId));
}

async function getStickyRoleIds(guildId) {
    return stickyRoleDAO.getConfiguredRoleIds(String(guildId));
}

async function captureStickyRoles(guildMember) {
    const guildId = guildMember.guild.id;
    const memberId = guildMember.user.id;
    if (guildMember.user.bot) {
        await stickyRoleDAO.replaceMemberSnapshot(guildId, memberId, []);
        return [];
    }

    const configuredRoleIds = new Set(await getStickyRoleIds(guildId));
    const heldRoleIds = [...guildMember.roles.cache.keys()]
        .filter(roleId => configuredRoleIds.has(roleId));

    return stickyRoleDAO.replaceMemberSnapshot(guildId, memberId, heldRoleIds);
}

async function restoreStickyRoles(guildMember) {
    if (guildMember.user.bot) return [];

    const guild = guildMember.guild;
    const guildId = guild.id;
    const memberId = guildMember.user.id;
    const [snapshotRoleIds, configuredRoleIds] = await Promise.all([
        stickyRoleDAO.getMemberSnapshot(guildId, memberId),
        getStickyRoleIds(guildId),
    ]);
    const configured = new Set(configuredRoleIds);
    const restorableRoleIds = snapshotRoleIds.filter((roleId) => {
        const role = guild.roles.cache.get(roleId);
        return configured.has(roleId) && isRoleManageableByBot(role, guild);
    });

    if (restorableRoleIds.length > 0) {
        await guildMember.roles.add(restorableRoleIds, 'Restoring configured sticky roles');
    }
    await stickyRoleDAO.clearMemberSnapshot(guildId, memberId);
    return restorableRoleIds;
}

module.exports = {
    addStickyRole,
    captureStickyRoles,
    getStickyRoleIds,
    isRoleManageableByBot,
    removeStickyRole,
    restoreStickyRoles,
    roleBelongsToGuild,
};
