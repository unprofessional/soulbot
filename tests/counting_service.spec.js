const { EventEmitter } = require('node:events');
const { Events } = require('discord.js');
jest.mock('../store/db/pool.js', () => ({ pool: { query: jest.fn(async () => ({ rows: [] })) } }));
jest.mock('../app/lifecycle.js', () => ({ shouldAcceptWork: jest.fn(() => true), registerDrainHandler: jest.fn() }));
jest.mock('../store/dao/counting.dao.js', () => ({ CountingDAO: jest.fn(() => ({ get: jest.fn(), submit: jest.fn(), suspendMissing: jest.fn() })) }));
const service = require('../features/counting/service.js');
const { shouldAcceptWork } = require('../app/lifecycle.js');
let client;
beforeEach(async () => {
    jest.clearAllMocks();
    shouldAcceptWork.mockReturnValue(true);
    client = new EventEmitter();
    client.guilds = { cache: new Map() };
    await service.initializeCounting(client);
    client.emit(Events.ClientReady);
});
function message(overrides = {}) {
    return { guildId: 'g', channelId: 'c', id: 'm', createdTimestamp: Date.now() + 1,
        channel: { permissionsFor: () => ({ has: () => true }) }, guild: { members: { me: {} } },
        author: { id: 'u', bot: false }, content: '1', attachments: new Map(),
        react: jest.fn(), reply: jest.fn(), ...overrides };
}
test('unconfigured channels keep the normal message path', async () => {
    service.dao.get.mockResolvedValue(undefined);
    expect(await service.handleMessage(message())).toBe(false);
    expect(service.dao.submit).not.toHaveBeenCalled();
});
test('accepted feedback failure cannot retry a committed submission', async () => {
    service.dao.get.mockResolvedValue({ id: 1 });
    service.dao.submit.mockResolvedValue({ outcome: 'accepted', game: { current_count: 0 } });
    const m = message({ react: jest.fn().mockRejectedValue(new Error('missing reaction access')) });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await service.handleMessage(m)).toBe(true);
    expect(service.dao.submit).toHaveBeenCalledTimes(1);
    spy.mockRestore();
});
test('bots, webhooks and offline posts cannot submit', async () => {
    service.dao.get.mockResolvedValue({ id: 1 });
    for (const m of [message({ author: { bot: true } }), message({ webhookId: 'w' }), message({ createdTimestamp: 0 })]) {
        expect(await service.handleMessage(m)).toBe(true);
    }
    client.emit(Events.ShardDisconnect);
    expect(await service.handleMessage(message())).toBe(true);
    expect(service.dao.submit).not.toHaveBeenCalled();
});
test('draining stops taking submissions', async () => {
    shouldAcceptWork.mockReturnValue(false);
    await service.handleMessage(message());
    expect(service.dao.submit).not.toHaveBeenCalled();
});
test('per-channel queue continues after failure and preserves execution order', async () => {
    const order = [];
    const first = service.serial('test', async () => { order.push(1); throw Error('fail'); });
    const second = service.serial('test', async () => { order.push(2); });
    await Promise.allSettled([first, second]);
    expect(order).toEqual([1, 2]);
});

test.each(['retired', 'paused', 'suspended'])('%s games leave ordinary chat on the normal path', async state => {
    service.dao.get.mockResolvedValue({ state });
    for (const content of ['hello there', '1 please', '']) {
        const m = message({ content });
        expect(await service.handleMessage(m)).toBe(false);
        expect(m.reply).not.toHaveBeenCalled();
    }
    expect(service.dao.submit).not.toHaveBeenCalled();
});
test('retired games also leave numbers on the normal path', async () => {
    service.dao.get.mockResolvedValue({ state: 'retired' });
    expect(await service.handleMessage(message())).toBe(false);
    expect(service.dao.submit).not.toHaveBeenCalled();
});
test.each(['paused', 'suspended'])('%s games explain numeric attempts without deleting them', async state => {
    service.dao.get.mockResolvedValue({ state });
    service.dao.submit.mockResolvedValue({ outcome: state, game: { current_count: 0 } });
    const m = message({ content: ' 001 ', delete: jest.fn() });
    expect(await service.handleMessage(m)).toBe(true);
    expect(m.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining(state) }));
    expect(m.delete).not.toHaveBeenCalled();
    expect(await service.handleMessage(message({ attachments: new Map([['image', {}]]) }))).toBe(false);
    expect(service.dao.submit).toHaveBeenCalledTimes(1);
});
test('a game retired while queued returns the message to normal processing', async () => {
    service.dao.get.mockResolvedValue({ state: 'active' });
    service.dao.submit.mockResolvedValue({ outcome: 'ignored', game: { state: 'retired' } });
    const m = message();
    expect(await service.handleMessage(m)).toBe(false);
    expect(m.reply).not.toHaveBeenCalled();
    expect(m.react).not.toHaveBeenCalled();
});
