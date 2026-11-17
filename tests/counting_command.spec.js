jest.mock('../features/counting/service.js', () => ({
    dao: { get: jest.fn(), manage: jest.fn() }, isAvailable: () => true,
    track: p => p, validateTarget: jest.fn(), diagnostics: () => ({ required: [], optional: [] }),
}));
const service = require('../features/counting/service.js');
const command = require('../commands/utility/counting.js');
const { PermissionFlagsBits: P } = require('discord.js');
function interaction(action, manager = false) {
    const permissions = { has: jest.fn(bit => bit === P.ViewChannel || (manager && bit === P.ManageGuild)) };
    const channel = { id: 'c', guildId: 'g', type: 0, permissionsFor: () => permissions };
    return { guildId: 'g', channel, user: { id: 'u' }, memberPermissions: permissions,
        guild: { members: { fetch: jest.fn(async () => ({ permissions })), fetchMe: jest.fn() }, roles: { fetch: jest.fn(async () => ({ id: 'r' })) } },
        options: { getSubcommand: () => action, getChannel: () => null, getRole: () => null, getString: () => null, getBoolean: () => null },
        reply: jest.fn(), deferReply: jest.fn(), editReply: jest.fn(),
    };
}
beforeEach(() => { jest.clearAllMocks(); service.dao.get.mockResolvedValue({ role_id: 'r', current_count: 3, record: 4, state: 'active' }); });
test('read actions are not hidden by a global management permission', () => {
    const json = command.data.toJSON();
    expect(json.default_member_permissions).toBeUndefined();
    for (const sub of json.options) {
        let optional = false;
        for (const o of sub.options || []) {
            expect(Boolean(optional && o.required)).toBe(false);
            if (!o.required) optional = true;
        }
    }
});
test('ordinary members can inspect current count', async () => {
    const i = interaction('current');
    await command.execute(i);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Count: 3; next: 4') }));
    expect(service.dao.manage).not.toHaveBeenCalled();
});
test('ordinary members cannot reset', async () => {
    const i = interaction('reset');
    await command.execute(i);
    expect(i.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Manage Server') }));
    expect(service.dao.manage).not.toHaveBeenCalled();
});
test('permission revoked after interaction is rechecked using current membership', async () => {
    const i = interaction('reset', true);
    i.guild.members.fetch.mockResolvedValue({ permissions: { has: () => false } });
    await command.execute(i);
    expect(service.dao.manage).not.toHaveBeenCalled();
});
test('private channel queries do not read game data', async () => {
    const i = interaction('current');
    i.channel.permissionsFor = () => ({ has: () => false });
    await command.execute(i);
    expect(service.dao.get).not.toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalledWith('You cannot view that channel.');
});
test('manager reset goes through transactional service', async () => {
    const i = interaction('reset', true);
    await command.execute(i);
    expect(service.dao.manage).toHaveBeenCalledWith('g', 'c', 'u', 'reset', expect.any(Object));
});
