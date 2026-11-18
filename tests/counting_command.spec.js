jest.mock('../features/counting/views.js', () => ({ buildView: jest.fn() }));
jest.mock('../features/counting/service.js', () => ({
    dao: { get: jest.fn(), list: jest.fn(), manage: jest.fn() }, isAvailable: jest.fn(() => true),
    track: p => p, serial: (_key, fn) => fn(), validateTarget: jest.fn(), connected: () => true,
    getNotices: () => ({ remember: jest.fn(), status: () => '' }),
}));
const { PermissionFlagsBits: P } = require('discord.js');
const service = require('../features/counting/service.js');
const command = require('../commands/utility/counting.js');
const ui = require('../features/counting/ui.js');
const { buildView } = require('../features/counting/views.js');
const { sessions } = require('../features/counting/sessions.js');
const game = { id: '1', guild_id: 'g', channel_id: 'c', role_id: 'r', history_id: '1', run_id: '1', version: '1', current_count: 3, record: 4, state: 'active', last_author_id: 'u', last_message_id: 'm', mistake_policy: 'reject', allow_consecutive: false };
function interaction(action, management = false, opts = {}) {
    const viewer = { id: 'u', permissions: { has: bit => management && bit === P.ManageGuild }, roles: { cache: new Map([['r', {}]]) } };
    const bot = { id: 'bot' };
    const channel = { id: 'c', guildId: 'g', type: 0, send: jest.fn(), permissionsFor: () => ({ has: () => true }) };
    const roles = new Map([['r', { id: 'r' }], ['new-role', { id: 'new-role' }]]);
    const channels = new Map([['c', channel]]);
    const guild = {
        id: 'g', members: { me: bot, fetch: jest.fn(async () => viewer), fetchMe: jest.fn(async () => bot) },
        channels: { fetch: jest.fn(async () => channels) }, roles: { cache: roles, fetch: jest.fn(async id => id ? roles.get(id) : roles) },
    };
    channel.guild = guild;
    return { guildId: 'g', channelId: 'c', channel, user: { id: 'u' }, guild, memberPermissions: viewer.permissions,
        options: { data: [{ name: action, options: Object.entries(opts).map(([name, value]) => ({ name, value })) }],
            getSubcommand: () => action, getChannel: () => opts.channel || null,
            getRole: () => opts.role ? { id: opts.role } : null, getString: name => opts[name] ?? null,
            getBoolean: name => opts[name] ?? null, getInteger: name => opts[name] ?? null },
        reply: jest.fn(), followUp: jest.fn(), deferReply: jest.fn(), deferUpdate: jest.fn(), editReply: jest.fn(),
    };
}
const text = i => i.editReply.mock.calls.at(-1)[0].embeds.map(e => e.description).join('\n');
function control(i, label) {
    return i.editReply.mock.calls.at(-1)[0].components.flatMap(r => r.toJSON().components).find(b => b.label === label)?.custom_id;
}
function click(i, customId) { return { ...i, options: undefined, customId, isButton: () => true, editReply: jest.fn(), reply: jest.fn(), deferUpdate: jest.fn() }; }
beforeEach(() => {
    jest.clearAllMocks(); sessions.items.clear();
    service.isAvailable.mockReturnValue(true);
    service.dao.get.mockResolvedValue({ ...game }); service.dao.list.mockResolvedValue([{ ...game }]);
    service.dao.manage.mockResolvedValue(true);
    buildView.mockResolvedValue({ content: 'Team standings', page: 1, pages: 1 });
});
afterEach(() => jest.restoreAllMocks());
test('setup has exactly one required role option; existing configure options and public reads remain', () => {
    const json = command.data.toJSON();
    expect(json.default_member_permissions).toBeUndefined();
    expect(json.options.find(o => o.name === 'setup').options.map(o => [o.name, o.required])).toEqual([['role', true]]);
    expect(json.options.find(o => o.name === 'configure').options.map(o => o.name)).toEqual(['channel', 'role', 'mistakes', 'consecutive', 'history']);
});
test('current, rules, and status answer different questions without mutations', async () => {
    const current = interaction('current'); await command.execute(current);
    expect(text(current)).toContain('Last: **3** · Next: **4**');
    expect(text(current)).toContain('Another teammate must post **4**');
    const settings = interaction('settings'); await command.execute(settings);
    expect(text(settings)).toContain('Wrong numbers keep progress');
    const status = interaction('status'); await command.execute(status);
    expect(text(status)).toContain('Ready to count');
    expect(service.dao.manage).not.toHaveBeenCalled();
});
test('ordinary members and revoked managers cannot reset', async () => {
    for (const i of [interaction('reset'), interaction('reset', true)]) {
        i.guild.members.fetch.mockResolvedValue({ permissions: { has: () => false } });
        await command.execute(i);
        expect(text(i)).toContain('Manage Server');
    }
    expect(service.dao.manage).not.toHaveBeenCalled();
});
test('private explicit channel never reaches game queries', async () => {
    const i = interaction('current'); i.channel.permissionsFor = () => ({ has: () => false });
    await command.execute(i);
    expect(text(i)).toContain('text channel you can view and read');
    expect(service.dao.get).not.toHaveBeenCalled();
});
test('help discovers only readable channels and explains manager preparation without a store', async () => {
    const i = interaction('help');
    const hidden = { ...i.channel, id: 'secret', permissionsFor: () => ({ has: () => false }) };
    i.guild.channels.fetch.mockResolvedValue(new Map([['c', i.channel], ['secret', hidden]]));
    await command.execute(i);
    expect(service.dao.list).toHaveBeenCalledWith('g', ['c']);
    expect(text(i)).toContain('Your counting channels');
    expect(text(i)).toContain('You counted last'); expect(text(i)).not.toContain('secret');
    service.isAvailable.mockReturnValue(false);
    const manager = interaction('help', true); await command.execute(manager);
    expect(text(manager)).toContain('Channel list temporarily unavailable');
    expect(text(manager)).toContain('at least two human teammates');
    expect(text(manager)).toContain('/counting setup role:');
    expect(text(manager)).not.toContain('No counting channels are available');
});
test('setup previews the invoking channel and confirms fixed defaults once', async () => {
    let current;
    service.dao.get.mockImplementation(async () => current);
    service.dao.manage.mockImplementation(async (_g, _c, _u, _a, options) => { current = { ...game, current_count: 0, record: 0 }; expect(options).toMatchObject({ roleId: 'r', policy: 'reject', consecutive: false, expected: null }); });
    const i = interaction('setup', true, { role: 'r' }); await command.execute(i);
    expect(text(i)).toContain('Start counting in <#c>'); expect(text(i)).toContain('Wrong numbers keep progress');
    expect(service.dao.manage).not.toHaveBeenCalled();
    const id = control(i, 'Start counting'); const component = click(i, id);
    await ui.handleComponent(component); await ui.handleComponent(click(i, id));
    expect(service.dao.manage).toHaveBeenCalledTimes(1);
    expect(text(component)).toContain('a different teammate posts **2**');
    expect(text(component)).toContain('setup did not assign roles or change permissions');
});
test('removed setup options and unsupported channel contexts give a retry path', async () => {
    const stale = interaction('setup', true, { role: 'r', mistakes: 'reset' }); await command.execute(stale);
    expect(text(stale)).toContain('Setup is simpler now');
    const thread = interaction('setup', true, { role: 'r' }); thread.channel.type = 11; await command.execute(thread);
    expect(text(thread)).toContain('Open the text channel'); expect(service.dao.manage).not.toHaveBeenCalled();
});
test('reset preview cancellation and wrong-owner controls cannot change state', async () => {
    const i = interaction('reset', true); await command.execute(i);
    const confirm = control(i, 'Confirm change'); const cancel = control(i, 'Cancel');
    const wrong = click(i, confirm); wrong.user = { id: 'other' }; await ui.handleComponent(wrong);
    expect(wrong.reply).toHaveBeenCalled(); expect(service.dao.manage).not.toHaveBeenCalled();
    await ui.handleComponent(click(i, cancel)); await ui.handleComponent(click(i, confirm));
    expect(service.dao.manage).not.toHaveBeenCalled();
});
test('stale confirmation shows a fresh preview and needs a new click', async () => {
    const i = interaction('reset', true); await command.execute(i);
    service.dao.manage.mockRejectedValueOnce(Object.assign(Error('changed'), { code: 'COUNTING_STALE' }));
    service.dao.get.mockResolvedValue({ ...game, current_count: 77, last_message_id: 'new' });
    const component = click(i, control(i, 'Confirm change')); await ui.handleComponent(component);
    expect(text(component)).toContain('Last: 77'); expect(component.followUp).toHaveBeenCalled();
    expect(control(component, 'Confirm change')).toBeDefined();
});
test('confirmation rechecks manager membership and channel visibility', async () => {
    const i = interaction('reset', true); await command.execute(i);
    i.guild.members.fetch.mockResolvedValue({ permissions: { has: () => false } });
    const component = click(i, control(i, 'Confirm change')); await ui.handleComponent(component);
    expect(text(component)).toContain('Manage Server'); expect(service.dao.manage).not.toHaveBeenCalled();
});
test('configure with no changes is an editor; irrelevant history is explained', async () => {
    const i = interaction('configure', true); await command.execute(i);
    expect(text(i)).toContain('Change rules:'); expect(service.dao.manage).not.toHaveBeenCalled();
    const bad = interaction('configure', true, { history: 'reset' }); await command.execute(bad);
    expect(text(bad)).toContain('only used when changing');
});
test('guide publication failure leaves game untouched with a retry path', async () => {
    const i = interaction('settings', true); await command.execute(i);
    i.channel.send.mockRejectedValue(Error('cannot send'));
    const component = click(i, control(i, 'Post channel guide')); await ui.handleComponent(component);
    expect(text(component)).toContain('guide could not be confirmed'); expect(service.dao.manage).not.toHaveBeenCalled();
});
test('ranking navigation reaches the same read builder without exposing mutations', async () => {
    const i = interaction('top'); buildView.mockResolvedValue({ content: 'Contributors', page: 1, pages: 2, scope: 'lifetime', channelId: 'c' });
    await command.execute(i);
    const component = click(i, control(i, 'Next page')); await ui.handleComponent(component);
    expect(buildView.mock.calls.at(-1)[3]).toMatchObject({ page: 2, channelId: 'c' });
    expect(service.dao.manage).not.toHaveBeenCalled();
});

test('discovery has distinct empty/ineligible states, multiple teams and valid page controls', async () => {
    const i = interaction('help');
    service.dao.list.mockResolvedValue([]); await command.execute(i);
    expect(text(i)).toContain('No counting channels are available to you');
    const channels = new Map(); const games = [];
    for (let n = 0; n < 6; n++) {
        const id = `team-${n}`; channels.set(id, { ...i.channel, id, name: id });
        games.push({ ...game, channel_id: id, role_id: n === 0 ? 'new-role' : 'r' });
    }
    i.guild.channels.fetch.mockResolvedValue(channels); service.dao.list.mockResolvedValue(games);
    await command.execute(i);
    expect(text(i)).toContain('new-role'); expect(text(i)).toContain('ask a server manager');
    expect(text(i)).not.toContain('team-5');
    const next = click(i, control(i, 'Next teams')); await ui.handleComponent(next);
    expect(text(next)).toContain('team-5'); expect(text(next)).toContain('Page 2/2');
    const descriptions = next.editReply.mock.calls.at(-1)[0].embeds;
    expect(descriptions.reduce((sum, e) => sum + e.description.length, 0)).toBeLessThan(6000);
});
test('unexpected database errors produce a reference without leaking the database message', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    service.dao.get.mockRejectedValue(Error('secret_db_schema_or_credentials'));
    const i = interaction('current'); await command.execute(i);
    expect(text(i)).toContain('reference'); expect(text(i)).not.toContain('secret_db_schema');
    spy.mockRestore();
});
