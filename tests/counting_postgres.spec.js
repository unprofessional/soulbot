// Opt-in: use ONLY a disposable PostgreSQL database. This test drops counting tables.
const fs = require('node:fs');
const { Pool } = require('pg');
jest.mock('../store/db/pool.js', () => ({ pool: {} }));
const { CountingDAO } = require('../store/dao/counting.dao.js');
const { CountingViewsDAO } = require('../store/dao/counting_views.dao.js');
const suite = process.env.COUNTING_TEST_DATABASE_URL ? describe : describe.skip;
suite('counting PostgreSQL integration (disposable database)', () => {
    let pool, dao;
    beforeAll(async () => {
        pool = new Pool({ connectionString: process.env.COUNTING_TEST_DATABASE_URL });
        dao = new CountingDAO(pool);
        await pool.query('DROP TABLE IF EXISTS counting_event, counting_game CASCADE');
        const schema = fs.readFileSync(require.resolve('../store/db/tables/counting.sql'), 'utf8');
        await pool.query(schema);
        await pool.query(schema); // migration is repeatable
        const viewsSchema = fs.readFileSync(require.resolve('../store/db/tables/counting_views.sql'), 'utf8');
        await pool.query(viewsSchema);
        await pool.query(viewsSchema);
    });
    afterAll(async () => { if (pool) await pool.end(); });
    test('concurrency, duplicate/reset delivery, isolation, and durable rehydration', async () => {
        await dao.manage('g', 'c', 'admin', 'setup', { roleId: 'r', policy: 'reset' });
        await dao.manage('g', 'other', 'admin', 'setup', { roleId: 'r2' });
        const submit = (id, content, author = 'a') => dao.submit('g', 'c', { messageId: id, authorId: author, content }, async () => true);
        const results = await Promise.all(Array.from({ length: 8 }, () => submit('one', '1')));
        expect(results.filter(r => r.outcome === 'accepted')).toHaveLength(1);
        expect(results.filter(r => r.outcome === 'duplicate')).toHaveLength(7);
        expect((await dao.get('g', 'c')).current_count).toBe(1);
        expect((await submit('two', '2', 'b')).outcome).toBe('accepted');
        expect((await submit('mistake', '9', 'a')).outcome).toBe('reset');
        expect((await submit('mistake', '9', 'a')).outcome).toBe('duplicate');
        expect((await submit('new-run', '1')).outcome).toBe('accepted');
        const persisted = await new CountingDAO(pool).get('g', 'c');
        expect(persisted).toMatchObject({ current_count: 1, record: 2, last_author_id: 'a', run_id: '2' });
        expect((await dao.get('g', 'other')).current_count).toBe(0);
        expect(await dao.get('different-guild', 'c')).toBeUndefined();
        const events = await pool.query("SELECT kind FROM counting_event WHERE message_id IS NOT NULL ORDER BY id");
        expect(events.rows.map(e => e.kind)).toEqual(['accepted', 'accepted', 'reset', 'accepted']);
    });
    test('duplicate roles are constrained and management is atomic', async () => {
        await expect(dao.manage('g', 'duplicate-role', 'admin', 'setup', { roleId: 'r' })).rejects.toMatchObject({ code: '23505' });
        expect(await dao.get('g', 'duplicate-role')).toBeUndefined();
        await dao.manage('g', 'c', 'admin', 'pause');
        expect((await dao.submit('g', 'c', { messageId: 'paused', authorId: 'b', content: '2' }, async () => true)).outcome).toBe('paused');
        await dao.manage('g', 'c', 'admin', 'configure', { roleId: 'new-role', history: 'reset' });
        expect(await dao.get('g', 'c')).toMatchObject({ history_id: '2', current_count: 0, record: 0, last_author_id: null });
        await dao.manage('g', 'c', 'admin', 'resume');
        await dao.suspendMissing('g', 'role_id', 'new-role');
        expect((await dao.get('g', 'c')).state).toBe('suspended');
    });
    test('views count accepted ledger entries across runs, ties, pages, privacy and reassignment', async () => {
        const views = new CountingViewsDAO(pool);
        await dao.manage('views-g', 'team-a', 'admin', 'setup', { roleId: 'role-a', consecutive: true });
        const submit = (channel, id, author, content) => dao.submit('views-g', channel, {
            messageId: `view-${id}`, authorId: author, content: String(content),
        }, async () => true);
        for (let n = 1; n <= 12; n++) {
            expect((await submit('team-a', n, `user-${String(n).padStart(2, '0')}`, n)).outcome).toBe('accepted');
        }
        await submit('team-a', '13', 'user-01', 13);
        await submit('team-a', 'wrong', 'user-01', 99);
        await submit('team-a', '13', 'user-01', 13); // duplicate, not a second contribution
        await dao.manage('views-g', 'team-a', 'admin', 'reset');
        await submit('team-a', 'new-run', 'user-02', 1);
        let result = await views.top('views-g', 'team-a');
        expect(result.total).toBe('12');
        expect(result.entries.slice(0, 3)).toEqual([
            { author_id: 'user-01', contributions: '2', place: '1' },
            { author_id: 'user-02', contributions: '2', place: '1' },
            { author_id: 'user-03', contributions: '1', place: '3' },
        ]);
        const secondPage = await views.top('views-g', 'team-a', 'lifetime', 2);
        expect(secondPage.entries.map(e => e.author_id)).toEqual(['user-11', 'user-12']);
        expect((await views.top('views-g', 'team-a', 'lifetime', 3)).entries).toEqual([]);
        expect((await views.top('views-g', 'team-a', 'run')).entries).toEqual([{ author_id: 'user-02', contributions: '1', place: '1' }]);
        expect(await views.top('other-guild', 'team-a')).toBeUndefined();
        await dao.manage('views-g', 'team-b', 'admin', 'setup', { roleId: 'role-b' });
        await submit('team-b', 'b-1', 'user-10', 1);
        await dao.manage('views-g', 'team-b', 'admin', 'pause');
        await dao.manage('views-g', 'hidden', 'admin', 'setup', { roleId: 'role-hidden' });
        await submit('hidden', 'hidden-1', 'user-10', 1);
        const board = await views.leaderboard('views-g', ['team-a', 'team-b']);
        expect(board.total).toBe('2');
        expect(board.entries.map(e => [e.channel_id, e.place, e.current_count, e.record])).toEqual([
            ['team-a', '1', '1', '13'], ['team-b', '1', '1', '1'],
        ]);
        expect((await views.leaderboard('views-g', [])).total).toBe('0');
        expect((await views.leaderboard('other-guild', ['team-a'])).total).toBe('0');
        await dao.manage('views-g', 'team-b', 'admin', 'retire');
        expect((await views.leaderboard('views-g', ['team-a', 'team-b'])).total).toBe('1');
        expect((await views.top('views-g', 'team-b')).entries).toHaveLength(1); // readable archived game
        await dao.manage('views-g', 'team-a', 'admin', 'configure', { roleId: 'retained-role', history: 'retain' });
        expect((await views.top('views-g', 'team-a')).total).toBe('12');
        await dao.manage('views-g', 'team-a', 'admin', 'configure', { roleId: 'fresh-role', history: 'reset' });
        result = await views.top('views-g', 'team-a');
        expect(result.total).toBe('0');
        expect(result.entries).toEqual([]);
    });

    test('confirmation snapshots reject counts/resets/reassignments made after the preview', async () => {
        const { snapshot } = require('../store/dao/counting.dao.js');
        await dao.manage('confirm-g', 'channel', 'admin', 'setup', { roleId: 'team', consecutive: true, expected: null });
        const before = await dao.get('confirm-g', 'channel');
        await dao.submit('confirm-g', 'channel', { messageId: 'confirmation-race', authorId: 'member', content: '1' }, async () => true);
        await expect(dao.manage('confirm-g', 'channel', 'admin', 'reset', { expected: snapshot(before) })).rejects.toMatchObject({ code: 'COUNTING_STALE' });
        expect((await dao.get('confirm-g', 'channel')).current_count).toBe(1);
        const fresh = await dao.get('confirm-g', 'channel');
        await dao.manage('confirm-g', 'channel', 'admin', 'reset', { expected: snapshot(fresh) });
        await expect(dao.manage('confirm-g', 'channel', 'admin', 'reset', { expected: snapshot(fresh) })).rejects.toMatchObject({ code: 'COUNTING_STALE' });
        const reassignment = snapshot(await dao.get('confirm-g', 'channel'));
        await dao.manage('confirm-g', 'channel', 'admin', 'configure', { roleId: 'other-team', history: 'reset' });
        await expect(dao.manage('confirm-g', 'channel', 'admin', 'retire', { expected: reassignment })).rejects.toMatchObject({ code: 'COUNTING_STALE' });
        expect((await dao.get('confirm-g', 'channel')).state).toBe('active');
    });

});
