const { CountingNotices, remember, isCountingChannel } = require('../features/counting/notices.js');
const base = { id: '1', guild_id: 'g', channel_id: 'c', role_id: 'r', state: 'active', current_count: 42 };
let fixture;
function setup(games = [base]) {
    let now = 1000; const timers = [];
    const guild = { id: 'g', shardId: 0, members: { me: {} }, roles: { fetch: jest.fn(async () => ({ id: 'r' })) } };
    const channels = new Map(games.map(g => [g.channel_id, { id: g.channel_id, guildId: g.guild_id, type: 0, guild, permissionsFor: () => ({ has: () => true }), send: jest.fn(async () => ({})) }]));
    guild.channels = { fetch: jest.fn(async id => channels.get(id)) };
    const client = { guilds: { cache: new Map([['g', guild]]) } };
    const dao = { list: jest.fn(async () => games), get: jest.fn(async (_guild, id) => games.find(g => g.channel_id === id)), suspendMissing: jest.fn() };
    const notice = new CountingNotices({ dao, client, serial: (_key, fn) => fn(), track: p => p, accepting: () => true, now: () => now, timeout: 20, schedule: fn => { timers.push(fn); return {}; } });
    games.forEach(g => notice.remember(g));
    return { notice, dao, client, guild, channels, timers, advance: n => { now += n; } };
}
beforeEach(() => { fixture = setup(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
test('each channel gets its own saved values and remains gated until the attempt', async () => {
    const f = setup([base, { ...base, id: '2', channel_id: 'b', current_count: 7 }]);
    let deliver; f.channels.get('c').send.mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
    const recovery = f.notice.recover();
    expect(f.notice.isBlocked('g', 'c')).toBe(true);
    while (!deliver) await Promise.resolve();
    expect(f.notice.isBlocked('g', 'c')).toBe(true); deliver({}); await recovery;
    expect(f.channels.get('c').send.mock.calls[0][0].content).toBe('Back online. Offline numbers may be missed. Last: 42. Next: 43.');
    expect(f.channels.get('b').send.mock.calls[0][0].content).toContain('Last: 7. Next: 8.');
    expect(f.notice.isBlocked('g', 'c')).toBe(false); expect(f.notice.cutoff('g', 'c')).toBe(1000);
    await f.notice.recover(0); expect(f.channels.get('c').send).toHaveBeenCalledTimes(1);
});
test('disconnect/resume coalesces duplicate signals and suppresses old-epoch retries', async () => {
    const { notice, channels, timers } = fixture;
    await notice.recover(); notice.disconnect(0); expect(notice.isBlocked('g', 'c')).toBe(true);
    channels.get('c').send.mockRejectedValueOnce(Error('denied'));
    const a = notice.recover(0); const b = notice.recover(0); expect(a).toBe(b); await a;
    expect(timers).toHaveLength(1);
    notice.disconnect(0); await notice.recover(0);
    const calls = channels.get('c').send.mock.calls.length;
    await timers[0](); await Promise.resolve();
    expect(channels.get('c').send).toHaveBeenCalledTimes(calls);
});
test('new disconnect during an in-flight recovery stays gated until the new generation recovers', async () => {
    const { notice, channels } = fixture;
    let deliver; channels.get('c').send.mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
    const old = notice.recover(0); while (!deliver) await Promise.resolve();
    notice.disconnect(0); deliver({}); await old;
    expect(notice.isBlocked('g', 'c')).toBe(true);
    await notice.recover(0); expect(notice.isBlocked('g', 'c')).toBe(false);
});
test('paused/suspended, new and limit games have accurate recovery copy', async () => {
    const games = [
        { ...base, state: 'paused', current_count: 0 },
        { ...base, channel_id: 'b', id: '2', state: 'suspended', current_count: Number.MAX_SAFE_INTEGER },
    ];
    const { notice, channels } = setup(games); await notice.recover();
    expect(channels.get('c').send.mock.calls[0][0].content).toBe('Bot online; counting paused. Offline numbers may be missed. Last: 0. Next: 1.');
    expect(channels.get('b').send.mock.calls[0][0].content).toContain('counting suspended.');
    expect(channels.get('b').send.mock.calls[0][0].content).toContain('Limit reached; reset needed.');
});
test('missing target suspends; retired games never get notices', async () => {
    const { notice, dao, guild, channels } = fixture;
    guild.roles.fetch.mockResolvedValue(null); await notice.recover();
    expect(dao.suspendMissing).toHaveBeenCalledWith('g', 'role_id', 'r');
    expect(channels.get('c').send.mock.calls[0][0].content).toContain('counting suspended');
    dao.get.mockResolvedValue({ ...base, state: 'retired' });
    notice.disconnect(0); await notice.recover(0); expect(channels.get('c').send).toHaveBeenCalledTimes(1);
});
test('failed send retries read fresh counts, reuse nonce, and do not indefinitely gate counting', async () => {
    const { notice, channels, dao, timers } = fixture;
    channels.get('c').send.mockImplementationOnce(() => new Promise(() => {}));
    await notice.recover(); expect(notice.isBlocked('g', 'c')).toBe(false);
    expect(notice.status('g', 'c')).toContain('failed');
    dao.get.mockResolvedValue({ ...base, current_count: 50 });
    await timers.shift()();
    // Scheduled callbacks track asynchronous work; allow it to finish without a wall-clock sleep.
    for (let i = 0; i < 25; i++) await Promise.resolve();
    const sent = channels.get('c').send.mock.calls;
    expect(sent[1][0].content).toContain('Last: 50. Next: 51.'); expect(sent[0][0].nonce).toBe(sent[1][0].nonce);
});
test('first failure warns immediately, deduplicates, reminds only after 60s and resets after recovery', async () => {
    const { notice, channels, advance } = fixture; const channel = channels.get('c');
    await notice.failure(channel); await notice.failure(channel);
    expect(channel.send).toHaveBeenCalledTimes(1); expect(channel.send.mock.calls[0][0].content).toContain('was not counted');
    advance(60000); await notice.failure(channel); expect(channel.send).toHaveBeenCalledTimes(2);
    notice.recovered('g', 'c'); await notice.failure(channel, true);
    expect(channel.send).toHaveBeenCalledTimes(3); expect(channel.send.mock.calls[2][0].content).toContain('Could not confirm');
});
test('failed warnings are not marked delivered and retries are bounded', async () => {
    const { notice, channels, timers, advance } = fixture; const channel = channels.get('c'); channel.send.mockRejectedValue(Error('denied'));
    await notice.failure(channel); expect(notice.status('g', 'c')).toContain('could not be delivered');
    advance(2000); await timers.shift()(); for (let i = 0; i < 10; i++) await Promise.resolve();
    advance(4000); await timers.shift()(); for (let i = 0; i < 10; i++) await Promise.resolve();
    advance(60000); await notice.failure(channel); expect(channel.send).toHaveBeenCalledTimes(3); expect(timers).toHaveLength(0);
});
test('graceful notices use the right copy and counting channels are excluded from generic announcements', async () => {
    const { notice, channels } = fixture; const channel = channels.get('c');
    await notice.down('signal=SIGTERM'); expect(channel.send.mock.calls[0][0].content).toContain('Restarting.');
    await notice.down('signal=SIGINT'); expect(channel.send.mock.calls[1][0].content).toContain('Going offline.');
    expect(isCountingChannel('g', 'c')).toBe(true);
    remember({ ...base, state: 'retired' }); expect(isCountingChannel('g', 'c')).toBe(false);
});

test('reconnecting one shard does not gate another shard', async () => {
    const { notice, client, guild } = fixture;
    const other = { ...base, guild_id: 'other', channel_id: 'other-c', id: '2' };
    client.guilds.cache.set('other', { ...guild, id: 'other', shardId: 1 });
    notice.remember(other); notice.disconnect(0);
    expect(notice.isBlocked('g', 'c')).toBe(true);
    expect(notice.isBlocked('other', 'other-c')).toBe(false);
    const work = notice.recover(0);
    expect(notice.isBlocked('other', 'other-c')).toBe(false);
    await work;
});
test('configuration scan failure reopens known channels and has bounded recovery retries', async () => {
    const { notice, dao, timers } = fixture;
    dao.list.mockRejectedValue(Error('store down')); await notice.recover();
    expect(notice.isBlocked('g', 'c')).toBe(false); expect(notice.status('g', 'c')).toContain('scan failed');
    expect(timers).toHaveLength(1);
});

test('a startup reconnect is cleared by the initial all-shard recovery', async () => {
    const { notice } = fixture; notice.disconnect(0); await notice.recover();
    expect(notice.isBlocked('g', 'c')).toBe(false);
});
test('temporary guild unavailability cannot suspend a game as a deleted target', async () => {
    const { notice, guild, dao } = fixture; guild.available = false;
    await notice.recover(); expect(dao.suspendMissing).not.toHaveBeenCalled();
});
