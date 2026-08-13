const mockAddStickyRole = jest.fn();
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
                addRoleOption(optionCallback) {
                    optionCallback({
                        setName() { return this; },
                        setDescription() { return this; },
                        setRequired() { return this; },
                    });
                    return this;
                },
            });
            return this;
        }
    },
}));

jest.mock('../store/sticky_roles.js', () => ({
    addStickyRole: mockAddStickyRole,
    getStickyRoleIds: mockGetStickyRoleIds,
    removeStickyRole: mockRemoveStickyRole,
}));

const command = require('../commands/utility/sticky-role.js');

function buildInteraction({ subcommand = 'list', role = null, permitted = true } = {}) {
    const roleCache = new Map();
    if (role) roleCache.set(role.id, role);
    return {
        guildId: 'guild-1',
        guild: {
            id: 'guild-1',
            roles: { cache: roleCache },
        },
        memberPermissions: {
            has: jest.fn().mockReturnValue(permitted),
        },
        options: {
            getSubcommand: jest.fn().mockReturnValue(subcommand),
            getRole: jest.fn().mockReturnValue(role),
        },
        reply: jest.fn().mockResolvedValue(undefined),
    };
}

function role(overrides = {}) {
    return {
        id: 'role-1',
        guildId: 'guild-1',
        toString: () => '<@&role-1>',
        ...overrides,
    };
}

describe('/sticky-role', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetStickyRoleIds.mockResolvedValue([]);
    });

    test('rechecks Manage Roles permission during execution', async () => {
        const interaction = buildInteraction({ permitted: false });
        await command.execute(interaction);
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You need the Manage Roles permission to configure sticky roles.',
            ephemeral: true,
        });
        expect(mockGetStickyRoleIds).not.toHaveBeenCalled();
    });

    test('adds a manageable role', async () => {
        const selectedRole = role();
        mockAddStickyRole.mockResolvedValue({ ok: true, added: true });
        const interaction = buildInteraction({ subcommand: 'add', role: selectedRole });

        await command.execute(interaction);

        expect(mockAddStickyRole).toHaveBeenCalledWith(interaction.guild, selectedRole);
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '<@&role-1> is now sticky.',
            ephemeral: true,
            allowedMentions: { parse: [] },
        });
    });

    test('rejects a role belonging to another server', async () => {
        const interaction = buildInteraction({
            subcommand: 'add',
            role: role({ guildId: 'guild-2' }),
        });
        await command.execute(interaction);
        expect(mockAddStickyRole).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'That role must belong to this server.',
            ephemeral: true,
        });
    });

    test('lists configured roles and identifies deleted roles', async () => {
        const selectedRole = role();
        mockGetStickyRoleIds.mockResolvedValue(['role-1', 'deleted-role']);
        const interaction = buildInteraction({ role: selectedRole });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Sticky roles:\n- <@&role-1>\n- Deleted role (deleted-role)',
            ephemeral: true,
            allowedMentions: { parse: [] },
        });
    });

    test('removes configuration and retained member snapshots', async () => {
        const selectedRole = role();
        mockRemoveStickyRole.mockResolvedValue(true);
        const interaction = buildInteraction({ subcommand: 'remove', role: selectedRole });

        await command.execute(interaction);

        expect(mockRemoveStickyRole).toHaveBeenCalledWith('guild-1', 'role-1');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '<@&role-1> is no longer sticky.',
            ephemeral: true,
            allowedMentions: { parse: [] },
        });
    });
});
