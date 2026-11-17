const { evaluate, MAX_COUNT } = require('../features/counting/domain.js');
const game = { state: 'active', current_count: 1, allow_consecutive: false, last_author_id: 'a', mistake_policy: 'reject' };
const attempt = { eligible: true, authorId: 'b', content: '2', attachments: false };
test('accepts only the next integer and respects alternation', () => {
    expect(evaluate(game, attempt)).toEqual({ outcome: 'accepted', number: 2 });
    expect(evaluate(game, { ...attempt, authorId: 'a' }).outcome).toBe('alternation');
    expect(evaluate({ ...game, allow_consecutive: true }, { ...attempt, authorId: 'a' }).outcome).toBe('accepted');
});
test.each(['2 hello', '02', '+2', '2.0', '1+1', '0', '-1', '9007199254740992', ''])('rejects malformed input %s without reset', content => {
    expect(evaluate({ ...game, mistake_policy: 'reset' }, { ...attempt, content }).outcome).toBe('format');
});
test('eligibility, attachments and lifecycle cannot reset a team', () => {
    expect(evaluate(game, { ...attempt, eligible: false }).outcome).toBe('ineligible');
    expect(evaluate(game, { ...attempt, attachments: true }).outcome).toBe('format');
    for (const state of ['paused', 'suspended', 'retired']) expect(evaluate({ ...game, state }, attempt).outcome).toBe(state);
});
test('supports both mistake rules and the count limit', () => {
    expect(evaluate(game, { ...attempt, content: '3' }).outcome).toBe('wrong');
    expect(evaluate({ ...game, mistake_policy: 'reset' }, { ...attempt, content: '3' }).outcome).toBe('reset');
    expect(evaluate({ ...game, current_count: MAX_COUNT }, attempt).outcome).toBe('limit');
});
