const { PermissionFlagsBits: P } = require('discord.js');
const copy = require('../features/counting/presentation.js');
const game = { role_id: 'r', current_count: 42, record: 50, state: 'active', mistake_policy: 'reject', allow_consecutive: false, last_author_id: 'u' };
const guild = { members: { me: { id: 'bot' } } };
const roles = new Map([['r', {}]]);
const viewer = { id: 'u', roles: { cache: new Map([['r', {}]]) }, permissions: { has: () => true } };
const channel = { id: 'c', permissionsFor: () => ({ has: () => true }) };
test('turn eligibility distinguishes role, member access, turn rule, and unavailable states', () => {
    expect(copy.participation(game, channel, guild, roles, viewer)).toContain('Another teammate');
    expect(copy.participation({ ...game, allow_consecutive: true }, channel, guild, roles, viewer)).toContain('Can count now');
    expect(copy.participation(game, channel, guild, roles, { ...viewer, roles: { cache: new Map() } })).toContain('ask a server manager');
    expect(copy.participation(game, { ...channel, permissionsFor: subject => ({ has: () => subject.id === 'bot' }) }, guild, roles, viewer)).toContain('cannot send');
    expect(copy.participation({ ...game, state: 'paused' }, channel, guild, roles, viewer)).not.toContain('Can count now');
});
test('status never labels a paused game ready and manager diagnostics name missing permissions', () => {
    const blocked = { ...channel, permissionsFor: () => ({ has: bit => bit !== P.SendMessages }) };
    const text = copy.readView('status', { ...game, state: 'paused' }, blocked, guild, { viewer, roles }, true);
    expect(text).toContain('**Paused**'); expect(text).not.toContain('Ready to count'); expect(text).toContain('Grant Soulbot Send Messages');
});
test('deleted role uses a repair path and guides have no stale next number', () => {
    expect(copy.participation(game, channel, guild, new Map(), viewer)).toContain('Team role deleted');
    expect(copy.guide(game, roles)).not.toContain('43');
    expect(copy.guide(game, roles)).toContain('/counting current');
});
