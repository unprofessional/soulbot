const MAX_COUNT = Number.MAX_SAFE_INTEGER;
// Inactive channels keep ordinary chat on the normal message path.
function shouldHandle(game, attempt) {
    if (game.state === 'retired') return false;
    if (['paused', 'suspended'].includes(game.state)) {
        return !attempt.attachments && /^\d+$/.test(attempt.content.trim());
    }
    return true;
}
function evaluate(game, attempt) {
    if (game.state !== 'active') return { outcome: game.state };
    if (!attempt.eligible) return { outcome: 'ineligible' };
    if (attempt.attachments || !/^[1-9]\d*$/.test(attempt.content.trim())) return { outcome: 'format' };
    const number = Number(attempt.content.trim());
    if (!Number.isSafeInteger(number)) return { outcome: 'format' };
    if (!game.allow_consecutive && game.last_author_id === attempt.authorId) return { outcome: 'alternation' };
    if (game.current_count >= MAX_COUNT) return { outcome: 'limit' };
    if (number !== game.current_count + 1) return { outcome: game.mistake_policy === 'reset' ? 'reset' : 'wrong' };
    return { outcome: 'accepted', number };
}
module.exports = { evaluate, MAX_COUNT, shouldHandle };
