const mockAddConfiguredRole = jest.fn();
const mockRemoveConfiguredRole = jest.fn();
const mockGetConfiguredRoleIds = jest.fn();
const mockReplaceMemberSnapshot = jest.fn();
const mockGetMemberSnapshot = jest.fn();
const mockClearMemberSnapshot = jest.fn();

jest.mock('discord.js', () => ({
    PermissionFlagsBits: { ManageRoles: BigInt(1) },
}));

jest.mock('../store/dao/sticky_role.dao.js', () => (
    jest.fn().mockImplementation(() => ({
        addConfiguredRole: mockAddConfiguredRole,
        removeConfiguredRole: mockRemoveConfiguredRole,
        getConfiguredRoleIds: mockGetConfiguredRoleIds,
        replaceMemberSnapshot: mockReplaceMemberSnapshot,
        getMemberSnapshot: mockGetMemberSnapshot,
        clearMemberSnapshot: mockClearMemberSnapshot,
    }))
));

const {
    addStickyRole,
    captureStickyRoles,
    isRoleManageableByBot,
    restoreStickyRoles,
} = require('../store/sticky_roles.js');

function buildGuild() {
    const guild = {
        id: 'guild-1',
        members: {
            me: {
                permissions: { has: jest.fn().mockReturnValue(true) },
                roles: {
                    highest: {
                        position: 10,
                        comparePositionTo: role => 10 - role.position,
                    },
                },
            },
        },
        roles: { cache: new Map() },
    };
    return guild;
}

function buildRole(guild, overrides = {}) {
    return {
        id: 'role-1',
        guild,
        managed: false,
        position: 5,
        ...overrides,
    };
}

function buildMember(guild, roleIds = [], overrides = {}) {
    return {
        guild,
        user: { id: 'user-1', bot: false },
        roles: {
            cache: new Map(roleIds.map(id => [id, { id }])),
            add: jest.fn().mockResolvedValue(undefined),
        },
        ...overrides,
    };
}

describe('sticky roles', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetConfiguredRoleIds.mockResolvedValue([]);
        mockReplaceMemberSnapshot.mockImplementation((_guild, _member, roles) => roles);
        mockGetMemberSnapshot.mockResolvedValue([]);
        mockClearMemberSnapshot.mockResolvedValue(undefined);
    });

    test('allows only ordinary roles below Soulbot', () => {
        const guild = buildGuild();
        expect(isRoleManageableByBot(buildRole(guild), guild)).toBe(true);
        expect(isRoleManageableByBot(buildRole(guild, { id: guild.id }), guild)).toBe(false);
        expect(isRoleManageableByBot(buildRole(guild, { managed: true }), guild)).toBe(false);
        expect(isRoleManageableByBot(buildRole(guild, { position: 10 }), guild)).toBe(false);
        guild.members.me.permissions.has.mockReturnValue(false);
        expect(isRoleManageableByBot(buildRole(guild), guild)).toBe(false);
        expect(isRoleManageableByBot(buildRole({ id: 'guild-2' }), guild)).toBe(false);
    });

    test('rejects unmanageable configuration before persistence', async () => {
        const guild = buildGuild();
        await expect(addStickyRole(guild, buildRole(guild, { position: 11 })))
            .resolves.toEqual({ ok: false, reason: 'unmanageable' });
        expect(mockAddConfiguredRole).not.toHaveBeenCalled();
    });

    test('captures only configured roles held by a departing member', async () => {
        const guild = buildGuild();
        mockGetConfiguredRoleIds.mockResolvedValue(['role-1', 'role-2']);
        const member = buildMember(guild, ['role-1', 'unrelated']);

        await expect(captureStickyRoles(member)).resolves.toEqual(['role-1']);
        expect(mockReplaceMemberSnapshot).toHaveBeenCalledWith(
            'guild-1', 'user-1', ['role-1']
        );
    });

    test('restores only roles that remain configured, present, and manageable', async () => {
        const guild = buildGuild();
        const goodRole = buildRole(guild, { id: 'role-good' });
        const tooHigh = buildRole(guild, { id: 'role-high', position: 11 });
        guild.roles.cache.set(goodRole.id, goodRole);
        guild.roles.cache.set(tooHigh.id, tooHigh);
        mockGetMemberSnapshot.mockResolvedValue([
            'role-good', 'role-high', 'role-deleted', 'role-removed',
        ]);
        mockGetConfiguredRoleIds.mockResolvedValue([
            'role-good', 'role-high', 'role-deleted',
        ]);
        const member = buildMember(guild);

        await expect(restoreStickyRoles(member)).resolves.toEqual(['role-good']);
        expect(member.roles.add).toHaveBeenCalledWith(
            ['role-good'], 'Restoring configured sticky roles'
        );
        expect(mockClearMemberSnapshot).toHaveBeenCalledWith('guild-1', 'user-1');
    });

    test('clears the snapshot after a no-op restore to make retries idempotent', async () => {
        const guild = buildGuild();
        mockGetMemberSnapshot.mockResolvedValue(['deleted-role']);
        mockGetConfiguredRoleIds.mockResolvedValue(['deleted-role']);
        const member = buildMember(guild);

        await expect(restoreStickyRoles(member)).resolves.toEqual([]);
        expect(member.roles.add).not.toHaveBeenCalled();
        expect(mockClearMemberSnapshot).toHaveBeenCalledWith('guild-1', 'user-1');
    });
});
