const mockAssignStickyRole = jest.fn();
const mockGetStickyRoleIds = jest.fn();
const mockRemoveStickyRole = jest.fn();

jest.mock('discord.js', () => ({
    PermissionFlagsBits: { ManageRoles: BigInt(1) },
    SlashCommandBuilder: class SlashCommandBuilder {
        setName() { return this; }
        setDescription() { return this; }
        setDMPermission() { return this; }
        setDefaultMemberPermissions() { return this; }
        addSubcommand(callback) {
            callback({
                setName() { return this; },
                setDescription() { return this; },
                addUserOption(fn) {
                    fn(mockOptionBuilder());
                    return this;
                },
                addRoleOption(fn) {
                    fn(mockOptionBuilder());
                    return this;
                },
            });
            return this;
        }
    },
}));

function mockOptionBuilder() {
    return {
        setName() { return this; },
        setDescription() { return this; },
        setRequired() { return this; },
    };
}

jest.mock('../store/sticky_roles.js', () => ({
    assignStickyRole: mockAssignStickyRole,
    getStickyRoleIds: mockGetStickyRoleIds,
    removeStickyRole: mockRemoveStickyRole,
}));

const command = require('../commands/utility/sticky-role.js');

function role(overrides = {}) {
    return {
        id: 'role-1',
        guildId: 'guild-1',
        toString: () => '<@&role-1>',
        ...overrides,
    };
}

function buildInteraction({
    subcommand = 'list', selectedRole = null, permitted = true, user = null,
} = {}) {
    const selectedUser = user || { id: 'target-1', bot: false };
    const member = { user: selectedUser };
    const roleCache = new Map();
    if (selectedRole) roleCache.set(selectedRole.id, selectedRole);
    return {
        guildId: 'guild-1',
        guild: {
            id: 'guild-1',
            members: { fetch: jest.fn().mockResolvedValue(member) },
            roles: { cache: roleCache },
        },
        memberPermissions: { has: jest.fn().mockReturnValue(permitted) },
        options: {
            getSubcommand: jest.fn().mockReturnValue(subcommand),
            getUser: jest.fn().mockReturnValue(selectedUser),
            getRole: jest.fn().mockReturnValue(selectedRole),
        },
        reply: jest.fn().mockResolvedValue(undefined),
        selectedUser,
        member,
    };
}

describe('/sticky-role member assignments', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetStickyRoleIds.mockResolvedValue([]);
    });

    test('rechecks Manage Roles permission during execution', async () => {
        const interaction = buildInteraction({ permitted: false });
        await command.execute(interaction);
        expect(interaction.guild.members.fetch).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You need the Manage Roles permission to configure sticky roles.',
            ephemeral: true,
        });
    });

    test('assigns a sticky role to the explicitly selected member', async () => {
        const selectedRole = role();
        mockAssignStickyRole.mockResolvedValue({ ok: true, added: true });
        const interaction = buildInteraction({ subcommand: 'add', selectedRole });

        await command.execute(interaction);

        expect(interaction.guild.members.fetch).toHaveBeenCalledWith('target-1');
        expect(mockAssignStickyRole).toHaveBeenCalledWith(interaction.member, selectedRole);
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '<@&role-1> is now sticky for <@target-1>.',
            ephemeral: true,
            allowedMentions: { parse: [] },
        });
    });

    test('removes only that user-role sticky binding', async () => {
        const selectedRole = role();
        mockRemoveStickyRole.mockResolvedValue(true);
        const interaction = buildInteraction({ subcommand: 'remove', selectedRole });

        await command.execute(interaction);

        expect(mockRemoveStickyRole).toHaveBeenCalledWith(
            'guild-1', 'target-1', 'role-1'
        );
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '<@&role-1> will no longer be restored for <@target-1>. Their current role is unchanged.',
            ephemeral: true,
            allowedMentions: { parse: [] },
        });
    });

    test('lists sticky roles for the explicitly selected member', async () => {
        const selectedRole = role();
        mockGetStickyRoleIds.mockResolvedValue(['role-1', 'deleted-role']);
        const interaction = buildInteraction({ selectedRole });

        await command.execute(interaction);

        expect(mockGetStickyRoleIds).toHaveBeenCalledWith('guild-1', 'target-1');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Sticky roles for <@target-1>:\n- <@&role-1>\n- Deleted role (deleted-role)',
            ephemeral: true,
            allowedMentions: { parse: [] },
        });
    });

    test('rejects bot targets', async () => {
        const interaction = buildInteraction({ user: { id: 'bot-1', bot: true } });
        await command.execute(interaction);
        expect(mockGetStickyRoleIds).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Sticky roles cannot be assigned to bots.',
            ephemeral: true,
        });
    });
});
