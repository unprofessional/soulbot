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
        await pool.query('DROP TABLE IF EXISTS counting_allowed_role, counting_event, counting_game CASCADE');
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
        const events = await pool.query("SELECT kind FROM counting_event WHERE message_id IS NOT NULL AND game_id IN (SELECT id FROM counting_game WHERE guild_id='g') ORDER BY id");
        expect(events.rows.map(e => e.kind)).toEqual(['accepted', 'accepted', 'reset', 'accepted']);
    });
    test('roles can participate in multiple channel teams and edits preserve history', async () => {
        await dao.manage('g', 'shared-role-channel', 'admin', 'setup', { roleId: 'r' });
        await expect(dao.manage('g', 'c', 'admin', 'setup', { roleId: 'r' })).rejects.toThrow('already has a game');
        const before = await dao.get('g', 'c');
        await dao.manage('g', 'c', 'admin', 'pause');
        expect((await dao.submit('g', 'c', { messageId: 'paused', authorId: 'b', content: '2' }, async () => true)).outcome).toBe('paused');
        await dao.manage('g', 'c', 'admin', 'role-add', { roleId: 'new-role' });
        await dao.manage('g', 'c', 'admin', 'role-remove', { roleId: 'r' });
        const after = await dao.get('g', 'c');
        for (const key of ['history_id', 'run_id', 'current_count', 'record', 'last_author_id']) expect(after[key]).toBe(before[key]);
        expect(after.role_ids).toEqual(['new-role']);
        await dao.manage('g', 'c', 'admin', 'resume');
        await dao.suspendMissing('g', 'role_id', 'new-role');
        expect((await dao.get('g', 'c')).state).toBe('suspended');
        expect((await dao.get('g', 'c')).role_ids).toEqual([]);
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
        await dao.manage('views-g', 'team-a', 'admin', 'role-add', { roleId: 'retained-role' });
        expect((await views.top('views-g', 'team-a')).total).toBe('12');
        await dao.manage('views-g', 'team-a', 'admin', 'role-remove', { roleId: 'role-a' });
        result = await views.top('views-g', 'team-a');
        expect(result.total).toBe('12');
        expect(result.entries).toHaveLength(10);
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
        await dao.manage('confirm-g', 'channel', 'admin', 'role-add', { roleId: 'other-team' });
        await expect(dao.manage('confirm-g', 'channel', 'admin', 'retire', { expected: reassignment })).rejects.toMatchObject({ code: 'COUNTING_STALE' });
        expect((await dao.get('confirm-g', 'channel')).state).toBe('active');
    });

    test('concurrent additions stop at ten, duplicates are idempotent and the final role is protected', async () => {
        await dao.manage('cap-g', 'cap-c', 'admin', 'setup', { roleId: 'initial' });
        const outcomes = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => dao.manage('cap-g', 'cap-c', 'admin', 'role-add', { roleId: `r${i}` })));
        expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(9);
        let game = await dao.get('cap-g', 'cap-c'); expect(game.role_ids).toHaveLength(10);
        await dao.manage('cap-g', 'cap-c', 'admin', 'role-add', { roleId: 'initial' });
        for (const roleId of game.role_ids.filter(id => id !== 'initial')) await dao.manage('cap-g', 'cap-c', 'admin', 'role-remove', { roleId });
        await expect(dao.manage('cap-g', 'cap-c', 'admin', 'role-remove', { roleId: 'initial' })).rejects.toThrow('at least one');
        game = await dao.get('cap-g', 'cap-c'); expect(game.role_ids).toEqual(['initial']);
        await dao.manage('race-g', 'race-c', 'admin', 'setup', { roleId: 'a' });
        await dao.manage('race-g', 'race-c', 'admin', 'role-add', { roleId: 'b' });
        const removals = await Promise.allSettled(['a', 'b'].map(roleId => dao.manage('race-g', 'race-c', 'admin', 'role-remove', { roleId })));
        expect(removals.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        expect((await dao.get('race-g', 'race-c')).role_ids).toHaveLength(1);
    });

    test('legacy upgrade is atomic, repeatable and preserves existing game/event identities', async () => {
        const client = await pool.connect();
        try {
            await client.query('CREATE SCHEMA counting_legacy_test');
            await client.query('SET search_path TO counting_legacy_test');
            await client.query(fs.readFileSync(require.resolve('./assets/sql/counting_legacy.sql'), 'utf8'));
            await client.query(`INSERT INTO counting_game(guild_id,channel_id,role_id,current_count,record,history_id,run_id,version,last_author_id,last_message_id,state)
                VALUES('legacy-g','legacy-c','legacy-role',42,52,3,4,8,'member','old-message','paused')`);
            await client.query(`INSERT INTO counting_event(game_id,history_id,run_id,version,kind,author_id,message_id,number)
                SELECT id,history_id,run_id,version,'accepted','member','old-message',42 FROM counting_game`);
            const before = (await client.query('SELECT * FROM counting_game')).rows[0];
            const events = (await client.query('SELECT * FROM counting_event')).rows;
            const schema = fs.readFileSync(require.resolve('../store/db/tables/counting.sql'), 'utf8');
            await expect(client.query(schema + '; SELECT nonexistent_counting_test_function();')).rejects.toBeDefined();
            expect((await client.query('SELECT role_id FROM counting_game')).rows[0].role_id).toBe('legacy-role');
            await client.query(schema); await client.query(schema);
            const upgraded = await new CountingDAO(client).get('legacy-g', 'legacy-c');
            expect(upgraded).toMatchObject({ id: before.id, current_count: 42, record: 52, history_id: '3', run_id: '4', version: '8', last_author_id: 'member', last_message_id: 'old-message', state: 'paused', role_ids: ['legacy-role'] });
            expect(upgraded.role_id).toBeUndefined();
            expect((await client.query('SELECT * FROM counting_event')).rows).toEqual(events);
            const board = await new CountingViewsDAO(client).leaderboard('legacy-g', ['legacy-c']);
            expect(board.entries[0]).toMatchObject({ channel_id: 'legacy-c', current_count: '42', record: '52' });
            expect((await client.query('SELECT COUNT(*)::int AS n FROM counting_allowed_role')).rows[0].n).toBe(1);
            await client.query('DELETE FROM counting_allowed_role');
            await client.query(schema);
            expect((await client.query('SELECT COUNT(*)::int AS n FROM counting_allowed_role')).rows[0].n).toBe(0); // Never resurrect a deleted legacy role.
        } finally {
            await client.query('SET search_path TO public');
            await client.query('DROP SCHEMA IF EXISTS counting_legacy_test CASCADE');
            client.release();
        }
    });

});
