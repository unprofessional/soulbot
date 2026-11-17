jest.mock('../store/db/pool.js', () => ({ pool: {} }));
const { CountingViewsDAO } = require('../store/dao/counting_views.dao.js');
test('standings rank only the guild and permitted channels, with deterministic pagination', async () => {
    const db = { query: jest.fn(async () => ({ rows: [{ total: '0', entries: [] }] })) };
    await new CountingViewsDAO(db).leaderboard('g', ['allowed'], 2);
    const [sql, params] = db.query.mock.calls[0];
    expect(params).toEqual(['g', ['allowed'], 10, 10]);
    expect(sql).toContain("guild_id=$1 AND channel_id=ANY($2::text[]) AND state <> 'retired'");
    expect(sql).toContain('RANK() OVER (ORDER BY current_count DESC)');
    expect(sql).toContain('ORDER BY current_count DESC, channel_id ASC');
});
test('invalid pagination/scope cannot reach the database', async () => {
    const db = { query: jest.fn() };
    const dao = new CountingViewsDAO(db);
    for (const page of [0, -1, NaN, 1.5, 1000001]) await expect(dao.leaderboard('g', [], page)).rejects.toThrow('page');
    await expect(dao.top('g', 'c', 'other')).rejects.toThrow('lifetime or run');
    expect(db.query).not.toHaveBeenCalled();
});
