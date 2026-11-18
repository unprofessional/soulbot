jest.mock('../store/db/pool.js', () => ({ pool: {} }));
const { CountingDAO } = require('../store/dao/counting.dao.js');
let client, dao;
const game = { id: '1', guild_id: 'g', channel_id: 'c', state: 'active', current_count: '1', record: '1', last_author_id: 'a', history_id: '1', run_id: '1', version: '1', mistake_policy: 'reset' };
beforeEach(() => {
    client = { query: jest.fn(async sql => {
        if (sql.includes('SELECT *')) return { rows: [{ ...game }] };
        if (sql.includes('SELECT id')) return { rowCount: 0 };
        return { rows: [], rowCount: 1 };
    }), release: jest.fn() };
    dao = new CountingDAO({ connect: jest.fn(async () => client) });
});
const attempt = { authorId: 'b', messageId: 'm', content: '2' };
test('commits acceptance and its deduplication ledger in one locked transaction', async () => {
    const result = await dao.submit('g', 'c', attempt, async () => true);
    expect(result.outcome).toBe('accepted');
    const queries = client.query.mock.calls.map(c => c[0]);
    expect(queries[0]).toBe('BEGIN');
    expect(queries[1]).toContain('pg_advisory_xact_lock');
    expect(queries[2]).toContain('FOR UPDATE');
    expect(queries.some(q => q.includes('INSERT INTO counting_event'))).toBe(true);
    expect(queries.at(-1)).toBe('COMMIT');
    expect(client.release).toHaveBeenCalled();
});
test('duplicate submissions cannot reset or count again', async () => {
    client.query.mockImplementation(async sql => sql.includes('SELECT *') ? { rows: [game] } : { rowCount: 1, rows: [] });
    const eligibility = jest.fn();
    expect((await dao.submit('g', 'c', attempt, eligibility)).outcome).toBe('duplicate');
    expect(eligibility).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
});
test('failure rolls back and releases; no partial count survives', async () => {
    client.query.mockImplementation(async sql => {
        if (sql.includes('SELECT *')) return { rows: [game] };
        if (sql.includes('INSERT INTO counting_event')) throw new Error('disk failure');
        return { rows: [], rowCount: 0 };
    });
    await expect(dao.submit('g', 'c', attempt, async () => true)).rejects.toThrow('disk failure');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
});
test('reset clears contributor and starts a new run', async () => {
    expect((await dao.submit('g', 'c', { ...attempt, content: '8' }, async () => true)).outcome).toBe('reset');
    expect(client.query.mock.calls.some(([sql]) => sql.includes('run_id=run_id+1,last_author_id=NULL'))).toBe(true);
});
test('role reassignment requires an explicit history choice', async () => {
    await expect(dao.manage('g', 'c', 'admin', 'configure', { roleId: 'new' })).rejects.toThrow('Teams are channels now');
});

test.each([
    ['retired', '2'], ['paused', 'hello'], ['suspended', 'hello'],
])('locked %s state ignores %s without eligibility, ledger or state changes', async (state, content) => {
    client.query.mockImplementation(async sql => sql.includes('SELECT *') ? { rows: [{ ...game, state }] } : { rows: [], rowCount: 0 });
    const eligibility = jest.fn();
    expect((await dao.submit('g', 'c', { ...attempt, content }, eligibility)).outcome).toBe('ignored');
    expect(eligibility).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some(([sql]) => /^(UPDATE|INSERT)/.test(sql))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
});

test('management preview guards count and last-entry state under the transaction lock', async () => {
    const { snapshot } = require('../store/dao/counting.dao.js');
    const expected = snapshot({ ...game, current_count: 1, record: 1 });
    // Config version stays unchanged while another count is accepted.
    client.query.mockImplementation(async sql => {
        if (sql.includes('SELECT *')) return { rows: [{ ...game, current_count: '2', last_message_id: 'new-count' }] };
        return { rows: [], rowCount: 0 };
    });
    await expect(dao.manage('g', 'c', 'admin', 'reset', { expected })).rejects.toMatchObject({ code: 'COUNTING_STALE' });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
});
test('setup preview cannot replace a game created by another manager', async () => {
    await expect(dao.manage('g', 'c', 'admin', 'setup', { roleId: 'r', expected: null })).rejects.toMatchObject({ code: 'COUNTING_STALE' });
    expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO counting_game'))).toBe(false);
});


test('role limit and last-role removal are enforced under the channel lock', async () => {
    client.query.mockImplementation(async sql => sql.includes('SELECT *') ? { rows: [{ ...game, role_ids: Array.from({ length: 10 }, (_, n) => `r${n}`) }] } : { rows: [], rowCount: 1 });
    await expect(dao.manage('g', 'c', 'admin', 'role-add', { roleId: 'extra' })).rejects.toThrow('10 roles');
    client.query.mockImplementation(async sql => sql.includes('SELECT *') ? { rows: [{ ...game, role_ids: ['only'] }] } : { rows: [], rowCount: 1 });
    await expect(dao.manage('g', 'c', 'admin', 'role-remove', { roleId: 'only' })).rejects.toThrow('at least one');
});
test('role edits change eligibility/version without resetting channel progress or history', async () => {
    client.query.mockImplementation(async sql => sql.includes('SELECT *') ? { rows: [{ ...game, role_ids: ['r'] }] } : { rows: [], rowCount: 1 });
    await dao.manage('g', 'c', 'admin', 'role-add', { roleId: 'other' });
    const updates = client.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE')).map(([sql]) => sql);
    expect(updates).toEqual(['UPDATE counting_game SET version=version+1 WHERE id=$1']);
    expect(client.query).toHaveBeenCalledWith('INSERT INTO counting_allowed_role(game_id,role_id) VALUES($1,$2)', ['1', 'other']);
});
test('role order cannot invalidate a preview but changed membership does', () => {
    const { snapshot } = require('../store/dao/counting.dao.js');
    expect(snapshot({ ...game, role_ids: ['b', 'a'] })).toEqual(snapshot({ ...game, role_ids: ['a', 'b'] }));
    expect(snapshot({ ...game, role_ids: ['a'] })).not.toEqual(snapshot({ ...game, role_ids: ['a', 'b'] }));
});

test('message-event lookup checks the scoped ledger without excluding old accepted history', async () => {
    const db = { query: jest.fn(async () => ({ rowCount: 1 })) };
    expect(await new CountingDAO(db).hasMessageEvent('g', 'c', 'accepted-old')).toBe(true);
    expect(db.query.mock.calls[0][1]).toEqual(['g', 'c', 'accepted-old']);
    expect(db.query.mock.calls[0][0]).toContain('g.guild_id=$1 AND g.channel_id=$2 AND e.message_id=$3');
    db.query.mockResolvedValue({ rowCount: 0 }); expect(await new CountingDAO(db).hasMessageEvent('g', 'c', 'unknown')).toBe(false);
});
