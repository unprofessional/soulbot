const mockAddAssignment = jest.fn();
const mockRemoveAssignment = jest.fn();
const mockGetAssignments = jest.fn();

jest.mock('discord.js', () => ({
    PermissionFlagsBits: { ManageRoles: BigInt(1) },
}));

jest.mock('../store/dao/sticky_role.dao.js', () => (
    jest.fn().mockImplementation(() => ({
        addAssignment: mockAddAssignment,
        removeAssignment: mockRemoveAssignment,
        getAssignments: mockGetAssignments,
    }))
));

const {
    assignStickyRole,
    isRoleManageableByBot,
    restoreStickyRoles,
} = require('../store/sticky_roles.js');

function buildGuild() {
    return {
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
}

function buildRole(guild, overrides = {}) {
    return { id: 'role-1', guild, managed: false, position: 5, ...overrides };
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

describe('member-specific sticky roles', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAddAssignment.mockResolvedValue(true);
        mockGetAssignments.mockResolvedValue([]);
    });

    test('allows only ordinary roles Soulbot can manage', () => {
        const guild = buildGuild();
        expect(isRoleManageableByBot(buildRole(guild), guild)).toBe(true);
        expect(isRoleManageableByBot(buildRole(guild, { id: guild.id }), guild)).toBe(false);
        expect(isRoleManageableByBot(buildRole(guild, { managed: true }), guild)).toBe(false);
        expect(isRoleManageableByBot(buildRole(guild, { position: 10 }), guild)).toBe(false);
        guild.members.me.permissions.has.mockReturnValue(false);
        expect(isRoleManageableByBot(buildRole(guild), guild)).toBe(false);
    });

    test('assigns the role now and persists it for the selected member', async () => {
        const guild = buildGuild();
        const member = buildMember(guild);
        const role = buildRole(guild);

        await expect(assignStickyRole(member, role))
            .resolves.toEqual({ ok: true, added: true });
        expect(member.roles.add).toHaveBeenCalledWith(
            'role-1', 'Moderator assigned sticky role'
        );
        expect(mockAddAssignment).toHaveBeenCalledWith(
            'guild-1', 'user-1', 'role-1'
        );
    });

    test('does not redundantly add a role the member already holds', async () => {
        const guild = buildGuild();
        const member = buildMember(guild, ['role-1']);
        await assignStickyRole(member, buildRole(guild));
        expect(member.roles.add).not.toHaveBeenCalled();
        expect(mockAddAssignment).toHaveBeenCalled();
    });

    test('restores the permanent assignments on every rejoin without deleting them', async () => {
        const guild = buildGuild();
        const goodRole = buildRole(guild, { id: 'role-good' });
        guild.roles.cache.set(goodRole.id, goodRole);
        mockGetAssignments.mockResolvedValue(['role-good', 'deleted-role']);
        const member = buildMember(guild);

        await expect(restoreStickyRoles(member)).resolves.toEqual(['role-good']);
        expect(member.roles.add).toHaveBeenCalledWith(
            ['role-good'], 'Restoring moderator-assigned sticky roles'
        );
        expect(mockRemoveAssignment).not.toHaveBeenCalled();
    });
});
