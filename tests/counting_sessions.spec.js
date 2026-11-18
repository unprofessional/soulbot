const { Sessions } = require('../features/counting/sessions.js');
const owner = { userId: 'u', guildId: 'g', originChannelId: 'c' };
test('sessions are opaque, bounded, owner-bound, expire and consume', () => {
    let now = 0; const sessions = new Sessions({ now: () => now, ttl: 120000, limit: 2 });
    const id = sessions.create(owner, { action: 'reset' });
    expect(id).not.toContain('reset');
    for (const field of ['userId', 'guildId', 'originChannelId']) expect(sessions.claim(id, { ...owner, [field]: 'wrong' }).error).toBeDefined();
    const claim = sessions.claim(id, owner); expect(claim.item.payload.action).toBe('reset');
    expect(sessions.claim(id, owner).error).toContain('processed');
    sessions.consume(claim.id); expect(sessions.claim(id, owner).error).toContain('expired');
    const expires = sessions.create(owner, {}); now = 120001;
    expect(sessions.claim(expires, owner).error).toContain('expired');
    const evicted = sessions.create(owner, {}); sessions.create(owner, {}); sessions.create(owner, {});
    expect(sessions.items.size).toBe(2); expect(sessions.claim(evicted, owner).error).toBeDefined();
});
