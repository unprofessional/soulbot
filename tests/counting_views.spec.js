const { PermissionFlagsBits: P } = require('discord.js');
jest.mock('../store/db/pool.js', () => ({ pool: { query: jest.fn(async () => ({})) } }));
const { pool } = require('../store/db/pool.js');
const views = require('../features/counting/views.js');
function channel(id, readable = true) {
    return { id, type: 0, guildId: 'g', permissionsFor: () => ({ has: bits => readable && bits.includes(P.ReadMessageHistory) }) };
}
function interaction({ action = 'leaderboard', target = null, page = 1, scope = null } = {}) {
    return {
        guildId: 'g', channelId: 'a',
        options: { getInteger: () => page, getString: () => scope, getChannel: () => target },
        guild: {
            channels: { fetch: jest.fn(async () => new Map([['a', channel('a')], ['hidden', channel('hidden', false)], ['foreign', { ...channel('foreign'), guildId: 'other' }]])) },
            roles: { fetch: jest.fn() }, members: { fetch: jest.fn(async () => ({ id: 'member' })) },
        }, editReply: jest.fn(), action,
    };
}
beforeEach(async () => {
    jest.restoreAllMocks();
    pool.query.mockResolvedValue({});
    await views.initializeViews();
});
test('filters private and foreign channels before ranking, with mentions suppressed', async () => {
    const spy = jest.spyOn(views.dao, 'leaderboard').mockResolvedValue({ total: '1', entries: [{ place: '1', channel_id: 'a', role_id: 'r', current_count: '9', record: '12', state: 'active' }] });
    const i = interaction();
    await views.replyView(i, {}, 'leaderboard');
    expect(spy).toHaveBeenCalledWith('g', ['a'], 1);
    expect(i.editReply).toHaveBeenCalledWith({ content: expect.stringContaining('1. <#a>'), allowedMentions: { parse: [] } });
});
test('denied explicit channel does not query contributions', async () => {
    const spy = jest.spyOn(views.dao, 'top');
    await expect(views.replyView(interaction({ target: { id: 'hidden' } }), {}, 'top')).rejects.toThrow('View Channel and Read Message History');
    expect(spy).not.toHaveBeenCalled();
});
test('current-run scope and page are forwarded; departed members keep their totals', async () => {
    const spy = jest.spyOn(views.dao, 'top').mockResolvedValue({ total: '12', state: 'paused', entries: [{ author_id: '123', place: '11', contributions: '2' }] });
    const i = interaction({ page: 2, scope: 'run' });
    i.guild.members.fetch.mockRejectedValue(new Error('Unknown member'));
    await views.replyView(i, {}, 'top');
    expect(spy).toHaveBeenCalledWith('g', 'a', 'run', 2);
    expect(i.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('11. Member (123; unavailable) — 2') }));
    expect(i.editReply.mock.calls[0][0].content).toContain('Page 2/2');
});
test('empty results and out-of-range pages have distinct messages', async () => {
    const spy = jest.spyOn(views.dao, 'leaderboard').mockResolvedValue({ total: '0', entries: [] });
    const i = interaction();
    await views.replyView(i, {}, 'leaderboard');
    expect(i.editReply.mock.calls[0][0].content).toContain('No visible counting teams.');
    spy.mockResolvedValue({ total: '12', entries: [] });
    await views.replyView(i, {}, 'leaderboard');
    expect(i.editReply.mock.calls[1][0].content).toContain('No entries on this page.');
});
test('failed permission refresh does not query standings', async () => {
    const spy = jest.spyOn(views.dao, 'leaderboard');
    const i = interaction();
    i.guild.channels.fetch.mockRejectedValue(Error('unavailable'));
    await expect(views.replyView(i, {}, 'leaderboard')).rejects.toThrow('unavailable');
    expect(spy).not.toHaveBeenCalled();
});
test('optional view migration failure disables views independently', async () => {
    pool.query.mockRejectedValue(Error('index unavailable'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await views.initializeViews();
    await expect(views.replyView(interaction(), {}, 'leaderboard')).rejects.toThrow('Core counting is still available');
    expect(log).toHaveBeenCalled();
});
