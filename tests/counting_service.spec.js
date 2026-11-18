const { EventEmitter } = require('node:events');
const { Events } = require('discord.js');
jest.mock('../store/db/pool.js', () => ({ pool: { query: jest.fn(async () => ({ rows: [] })) } }));
jest.mock('../app/lifecycle.js', () => ({ shouldAcceptWork: jest.fn(() => true), registerDrainHandler: jest.fn() }));
jest.mock('../store/dao/counting.dao.js', () => ({ CountingDAO: jest.fn(() => ({ get: jest.fn(), hasMessageEvent: jest.fn(async () => false), list: jest.fn(async () => []), submit: jest.fn(), suspendMissing: jest.fn(async () => {}) })) }));
const service = require('../features/counting/service.js');
const { shouldAcceptWork } = require('../app/lifecycle.js');
let client;
beforeEach(async () => {
    jest.clearAllMocks();
    service.dao.hasMessageEvent.mockReset().mockResolvedValue(false);
    service.dao.submit.mockReset();
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
    expect(m.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining(state === 'suspended' ? 'needs repair' : state) }));
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

test('ranking-index failure leaves core counting available', async () => {
    const { pool } = require('../store/db/pool.js');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockImplementation(async sql => {
        if (sql.includes('counting_accepted_contributors')) throw Error('index failed');
        return { rows: [] };
    });
    try {
        await service.initializeCounting(new EventEmitter());
        expect(service.isAvailable()).toBe(true);
    } finally {
        pool.query.mockImplementation(async () => ({ rows: [] }));
        log.mockRestore();
    }
});


test('any allowed role qualifies once; two matching roles do not bypass turn alternation', async () => {
    const { evaluate } = require('../features/counting/domain.js');
    const current = { id: '1', guild_id: 'g', channel_id: 'c', role_ids: ['squad', 'mod'], state: 'active', current_count: 0, record: 0, allow_consecutive: false, last_author_id: null, mistake_policy: 'reject' };
    service.dao.get.mockResolvedValue(current);
    let memberRoles = new Map([['mod', {}]]); const outcomes = [];
    service.dao.submit.mockImplementation(async (_g, _c, attempt, eligible) => {
        const result = evaluate(current, { ...attempt, eligible: await eligible(current) });
        outcomes.push(result.outcome);
        if (result.outcome === 'accepted') { current.current_count = result.number; current.last_author_id = attempt.authorId; }
        return { ...result, game: { ...current } };
    });
    const m = message({ guild: { id: 'g', members: { me: {}, fetch: jest.fn(async () => ({ roles: { cache: memberRoles } })) }, roles: { fetch: jest.fn(async id => ({ id })) } },
        channel: { permissionsFor: () => ({ has: () => true }), send: jest.fn() } });
    await service.handleMessage(m);
    expect(outcomes).toEqual(['accepted']); expect(current.current_count).toBe(1);
    memberRoles = new Map([['squad', {}], ['mod', {}]]);
    await service.handleMessage({ ...m, id: 'second', content: '2' });
    expect(outcomes).toEqual(['accepted', 'alternation']); expect(current.current_count).toBe(1);
    memberRoles = new Map();
    await service.handleMessage({ ...m, id: 'third', content: '2' });
    expect(outcomes.at(-1)).toBe('ineligible'); expect(current.current_count).toBe(1);
});


test('recent offline numbers get one targeted reply with fresh next state and never count', async () => {
    service.dao.get.mockResolvedValueOnce({ id: 1, state: 'active', current_count: 3 })
        .mockResolvedValue({ id: 1, state: 'active', current_count: 42 });
    const m = message({ createdTimestamp: Date.now() - 1000 });
    expect(await service.handleMessage(m)).toBe(true);
    await service.handleMessage(m);
    expect(m.reply).toHaveBeenCalledTimes(1);
    expect(m.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('next number is **43**'), allowedMentions: { parse: [], repliedUser: false }, enforceNonce: true }));
    expect(service.dao.submit).not.toHaveBeenCalled(); expect(m.react).not.toHaveBeenCalled();
});
test('accepted delayed duplicates, old chatter and non-human offline messages get no feedback', async () => {
    service.dao.get.mockResolvedValue({ id: 1, state: 'active', current_count: 42 });
    service.dao.hasMessageEvent.mockResolvedValue(true);
    const accepted = message({ createdTimestamp: Date.now() - 1000 });
    await service.handleMessage(accepted); expect(accepted.reply).not.toHaveBeenCalled();
    service.dao.hasMessageEvent.mockResolvedValue(false);
    for (const overrides of [{ content: 'hello' }, { content: '1 hello' }, { author: { bot: true } }, { webhookId: 'w' }, { attachments: new Map([['image', {}]]) }, { createdTimestamp: 0 }]) {
        const m = message({ createdTimestamp: Date.now() - 1000, ...overrides });
        await service.handleMessage(m); expect(m.reply).not.toHaveBeenCalled();
    }
    expect(service.dao.submit).not.toHaveBeenCalled();
});
test('a slow offline reply does not hold the channel queue or block recovery', async () => {
    service.dao.get.mockResolvedValue({ id: 1, state: 'active', current_count: 42 });
    let release;
    const m = message({ createdTimestamp: Date.now() - 1000, reply: jest.fn(() => new Promise(resolve => { release = resolve; })) });
    const feedback = service.handleMessage(m);
    for (let attempt = 0; attempt < 50 && !release; attempt++) await Promise.resolve();
    expect(release).toEqual(expect.any(Function));
    let ran = false;
    await service.serial('g:c', async () => { ran = true; });
    expect(ran).toBe(true); release(); await feedback;
});


test('accepted replays during a live outage do not get false not-counted warnings', async () => {
    service.dao.get.mockResolvedValue({ id: 1, state: 'active', current_count: 42 });
    service.dao.hasMessageEvent.mockResolvedValue(true);
    client.emit(Events.ShardDisconnect);
    const m = message({ channel: { id: 'c', guildId: 'g', permissionsFor: () => ({ has: () => true }), send: jest.fn() } });
    await service.handleMessage(m);
    expect(m.channel.send).not.toHaveBeenCalled(); expect(m.reply).not.toHaveBeenCalled();
    expect(service.dao.submit).not.toHaveBeenCalled();
});
test('the next fresh number still follows normal counting after an offline drop', async () => {
    service.dao.get.mockResolvedValue({ id: 1, state: 'active', current_count: 42 });
    const old = message({ createdTimestamp: Date.now() - 1000 }); await service.handleMessage(old);
    service.dao.submit.mockResolvedValue({ outcome: 'accepted', number: 43, game: { current_count: 42 } });
    const fresh = message({ id: 'fresh', content: '43' }); await service.handleMessage(fresh);
    expect(service.dao.submit).toHaveBeenCalledTimes(1);
    expect(fresh.react).toHaveBeenCalledWith('✅'); expect(old.react).not.toHaveBeenCalled();
});
