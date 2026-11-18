const { OfflineFeedback, RECENT_WINDOW_MS } = require('../features/counting/offline_feedback.js');
let dao, feedback, now;
function message(overrides = {}) {
    return { guildId: 'g', channelId: 'c', id: 'number', content: '43', createdTimestamp: now - 1000,
        author: { bot: false }, attachments: new Map(), reply: jest.fn(async () => ({})), ...overrides };
}
async function explain(m, cutoff = now) { await feedback.deliver(m, await feedback.prepare(m, cutoff)); }
beforeEach(() => {
    now = 2000000;
    dao = { hasMessageEvent: jest.fn(async () => false), get: jest.fn(async () => ({ state: 'active', current_count: 42 })) };
    feedback = new OfflineFeedback({ dao, accepting: () => true, now: () => now });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
test('offline feedback is a targeted, non-pinging reply with a stable Discord nonce', async () => {
    const m = message(); await explain(m);
    expect(dao.hasMessageEvent).toHaveBeenCalledWith('g', 'c', 'number');
    expect(m.reply).toHaveBeenCalledWith({ content: 'Not counted — that was posted while the bot was offline. The next number is **43**.', allowedMentions: { parse: [], repliedUser: false }, nonce: expect.any(String), enforceNonce: true });
    const fresh = new OfflineFeedback({ dao, accepting: () => true, now: () => now });
    expect((await fresh.prepare(m, now)).nonce).toBe(m.reply.mock.calls[0][0].nonce);
});
test('concurrent gateway replays claim once before awaits', async () => {
    const m = message(); await Promise.all([explain(m), explain(m), explain(m)]);
    expect(m.reply).toHaveBeenCalledTimes(1); expect(dao.get).toHaveBeenCalledTimes(1);
});
test('any previously processed event, including an accepted archived contribution, is left alone', async () => {
    dao.hasMessageEvent.mockResolvedValue(true);
    const m = message(); await explain(m);
    expect(dao.get).not.toHaveBeenCalled(); expect(m.reply).not.toHaveBeenCalled();
});
test.each([{ content: 'hi' }, { content: '42+1' }, { content: '43 hi' }, { author: { bot: true } }, { webhookId: 'webhook' }, { attachments: new Map([['image', {}]]) }])('only human digit attempts get offline feedback: %p', async overrides => {
    const m = message(overrides); await explain(m);
    expect(m.reply).not.toHaveBeenCalled(); expect(dao.hasMessageEvent).not.toHaveBeenCalled();
});
test('ancient messages, old recovery windows and non-gap messages do not get replies', async () => {
    for (const [timestamp, cutoff] of [[0, now], [now - RECENT_WINDOW_MS - 1, now], [now - RECENT_WINDOW_MS, now - RECENT_WINDOW_MS - 1], [now, now], [now + 1, now + 2]]) {
        const m = message({ createdTimestamp: timestamp }); await explain(m, cutoff); expect(m.reply).not.toHaveBeenCalled();
    }
});
test('state lookup and reply failures are best effort without invented next numbers or replay spam', async () => {
    dao.get.mockRejectedValue(Error('store unavailable'));
    const m = message(); await expect(explain(m)).resolves.toBeUndefined(); expect(m.reply).not.toHaveBeenCalled();
    dao.get.mockResolvedValue({ state: 'active', current_count: 42 });
    const broken = message({ id: 'broken', reply: jest.fn(async () => { throw Error('cannot reply'); }) });
    await explain(broken); await explain(broken); expect(broken.reply).toHaveBeenCalledTimes(1);
});
test('draining and retired games get no new replies; a full guard preserves prior dedup claims', async () => {
    feedback = new OfflineFeedback({ dao, accepting: () => false, now: () => now });
    const m = message(); await explain(m); expect(dao.get).not.toHaveBeenCalled();
    feedback = new OfflineFeedback({ dao, accepting: () => true, now: () => now, limit: 1 });
    await explain(m); const overflow = message({ id: 'overflow' }); await explain(overflow); await explain(m);
    expect(m.reply).toHaveBeenCalledTimes(1); expect(overflow.reply).not.toHaveBeenCalled();
    feedback = new OfflineFeedback({ dao, accepting: () => true, now: () => now });
    dao.get.mockResolvedValue({ state: 'retired', current_count: 42 }); const retired = message({ id: 'retired' });
    await explain(retired); expect(retired.reply).not.toHaveBeenCalled();
});
test('limit and paused games do not invite impossible counting', async () => {
    dao.get.mockResolvedValue({ state: 'paused', current_count: Number.MAX_SAFE_INTEGER });
    const m = message(); await explain(m); const text = m.reply.mock.calls[0][0].content;
    expect(text).toContain('Count limit reached'); expect(text).toContain('paused or needs repair');
});
