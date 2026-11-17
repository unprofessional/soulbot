// Opt-in: use ONLY a disposable PostgreSQL database. This test drops counting tables.
const fs = require('node:fs');
const { Pool } = require('pg');
jest.mock('../store/db/pool.js', () => ({ pool: {} }));
const { CountingDAO } = require('../store/dao/counting.dao.js');
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
});
