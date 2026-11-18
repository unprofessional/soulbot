const { pool } = require('../db/pool.js');
const { evaluate, shouldHandle, rolesOf, MAX_ROLES } = require('../../features/counting/domain.js');
const normalize = row => row && ({ ...row, role_ids: rolesOf(row), current_count: Number(row.current_count), record: Number(row.record) });
const SNAPSHOT_KEYS = ['id', 'history_id', 'run_id', 'version', 'state', 'role_ids', 'mistake_policy', 'allow_consecutive', 'current_count', 'record', 'last_author_id', 'last_message_id'];
function snapshot(game) {
    return game ? Object.fromEntries(SNAPSHOT_KEYS.map(key => [key, key === 'role_ids' ? rolesOf(game) : game[key] ?? null])) : null;
}
const SELECT_GAME = `SELECT *, COALESCE((SELECT array_agg(r.role_id ORDER BY r.role_id)
    FROM counting_allowed_role r WHERE r.game_id=counting_game.id), ARRAY[]::text[]) AS role_ids FROM counting_game`;
const invalid = message => Object.assign(new Error(message), { userFacing: true });
class CountingDAO {
    constructor(db = pool) { this.db = db; }
    async get(guildId, channelId) {
        const result = await this.db.query(`${SELECT_GAME} WHERE guild_id=$1 AND channel_id=$2`, [guildId, channelId]);
        return normalize(result.rows[0]);
    }
    async hasMessageEvent(guildId, channelId, messageId) {
        // Includes accepted entries in archived runs/history and other processed outcomes.
        const result = await this.db.query(`SELECT e.id FROM counting_event e
            JOIN counting_game g ON g.id=e.game_id
            WHERE g.guild_id=$1 AND g.channel_id=$2 AND e.message_id=$3`, [guildId, channelId, messageId]);
        return result.rowCount > 0;
    }
    async list(guildId = null, channelIds = null) {
        const result = await this.db.query(`${SELECT_GAME} WHERE state <> 'retired'
            AND ($1::text IS NULL OR guild_id=$1) AND ($2::text[] IS NULL OR channel_id=ANY($2::text[]))
            ORDER BY channel_id`, [guildId, channelIds]);
        return result.rows.map(normalize);
    }
    async transaction(guildId, channelId, fn) {
        const client = await this.db.connect();
        try {
            await client.query('BEGIN');
            // Serializes setup, configuration, and submissions even when a game does not yet exist.
            await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`counting:${guildId}:${channelId}`]);
            const result = await client.query(`${SELECT_GAME} WHERE guild_id=$1 AND channel_id=$2 FOR UPDATE OF counting_game`, [guildId, channelId]);
            const value = await fn(client, normalize(result.rows[0]));
            await client.query('COMMIT');
            return value;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally { client.release(); }
    }
    async event(client, game, kind, actor, messageId = null, number = null, detail = {}) {
        await client.query(`INSERT INTO counting_event(game_id,history_id,run_id,version,kind,author_id,message_id,number,detail)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [game.id, game.history_id, game.run_id, game.version, kind, actor, messageId, number, JSON.stringify(detail)]);
    }
    async submit(guildId, channelId, attempt, eligibility) {
        return this.transaction(guildId, channelId, async (client, game) => {
            if (!game) return null;
            // Recheck under the manager/submission lock: retirement or pause can race intake.
            if (!shouldHandle(game, attempt)) return { outcome: 'ignored', game };
            const duplicate = await client.query('SELECT id FROM counting_event WHERE message_id=$1', [attempt.messageId]);
            if (duplicate.rowCount) return { outcome: 'duplicate', game };
            const eligible = game.state === 'active' ? await eligibility(game) : false;
            const result = evaluate(game, { ...attempt, eligible });
            if (result.outcome === 'accepted') {
                await client.query(`UPDATE counting_game SET current_count=$2, record=GREATEST(record,$2),last_author_id=$3,last_message_id=$4 WHERE id=$1`,
                    [game.id, result.number, attempt.authorId, attempt.messageId]);
            } else if (result.outcome === 'reset') {
                await client.query('UPDATE counting_game SET current_count=0,run_id=run_id+1,last_author_id=NULL,last_message_id=NULL WHERE id=$1', [game.id]);
            }
            // Every attempted message is deduplicated, including reset-causing mistakes.
            await this.event(client, game, result.outcome, attempt.authorId, attempt.messageId, result.number);
            return { ...result, game };
        });
    }
    async manage(guildId, channelId, actor, action, options = {}) {
        return this.transaction(guildId, channelId, async (client, game) => {
            if (Object.hasOwn(options, 'expected') && JSON.stringify(snapshot(game)) !== JSON.stringify(options.expected)) {
                throw Object.assign(new Error('Game changed. Review the updated preview before confirming.'), { code: 'COUNTING_STALE', userFacing: true });
            }
            if (action === 'setup') {
                if (game) throw new Error('This channel already has a game; configure or resume it instead.');
                const result = await client.query(`INSERT INTO counting_game(guild_id,channel_id,mistake_policy,allow_consecutive)
                    VALUES($1,$2,$3,$4) RETURNING *`, [guildId, channelId, options.policy || 'reject', options.consecutive || false]);
                game = normalize(result.rows[0]);
                if (!options.roleId) throw invalid('Choose the first allowed role for this channel.');
                await client.query('INSERT INTO counting_allowed_role(game_id,role_id) VALUES($1,$2)', [game.id, options.roleId]);
                game.role_ids = [options.roleId];
            } else {
                if (!game) throw new Error('No counting game is configured here.');
                if (action === 'role-add' || action === 'role-remove') {
                    if (!options.roleId) throw invalid('Choose an allowed role to add or remove.');
                    const ids = rolesOf(game);
                    if (action === 'role-add') {
                        if (ids.includes(options.roleId)) return { unchanged: true };
                        if (ids.length >= MAX_ROLES) throw invalid('This channel already allows 10 roles. Remove one with /counting role-remove first.');
                        await client.query('INSERT INTO counting_allowed_role(game_id,role_id) VALUES($1,$2)', [game.id, options.roleId]);
                    } else {
                        if (!ids.includes(options.roleId)) return { unchanged: true };
                        if (ids.length <= 1) throw invalid('Keep at least one allowed role. Add a replacement with /counting role-add before removing the last role.');
                        await client.query('DELETE FROM counting_allowed_role WHERE game_id=$1 AND role_id=$2', [game.id, options.roleId]);
                    }
                    await client.query('UPDATE counting_game SET version=version+1 WHERE id=$1', [game.id]);
                } else if (action === 'configure') {
                    if (options.roleId || options.history) throw invalid('Teams are channels now. Use /counting role-add or role-remove; role changes keep all channel history.');
                    await client.query(`UPDATE counting_game SET mistake_policy=COALESCE($2,mistake_policy),allow_consecutive=COALESCE($3,allow_consecutive),version=version+1 WHERE id=$1`,
                        [game.id, options.policy ?? null, options.consecutive ?? null]);
                } else if (action === 'reset') {
                    await client.query('UPDATE counting_game SET current_count=0,run_id=run_id+1,last_author_id=NULL,last_message_id=NULL,version=version+1 WHERE id=$1', [game.id]);
                } else {
                    const state = { pause: 'paused', resume: 'active', retire: 'retired', suspend: 'suspended' }[action];
                    if (!state) throw new Error('Unknown counting action.');
                    await client.query('UPDATE counting_game SET state=$2,version=version+1 WHERE id=$1', [game.id, state]);
                }
            }
            await this.event(client, game, action, actor, null, null, { before: game, options });
            return true;
        });
    }
    async suspendMissing(guildId, field, id) {
        if (!['role_id', 'channel_id'].includes(field)) throw new Error('Invalid target');
        const result = await this.db.query(field === 'role_id'
            ? `SELECT channel_id FROM counting_game g JOIN counting_allowed_role r ON r.game_id=g.id WHERE g.guild_id=$1 AND r.role_id=$2`
            : `SELECT channel_id FROM counting_game WHERE guild_id=$1 AND channel_id=$2 AND state <> 'retired'`, [guildId, id]);
        for (const row of result.rows) await this.transaction(guildId, row.channel_id, async (client, game) => {
            if (!game) return;
            if (field === 'role_id') {
                if (!rolesOf(game).includes(id)) return;
                await client.query('DELETE FROM counting_allowed_role WHERE game_id=$1 AND role_id=$2', [game.id, id]);
                const state = rolesOf(game).length === 1 && game.state !== 'retired' ? 'suspended' : game.state;
                await client.query('UPDATE counting_game SET state=$2,version=version+1 WHERE id=$1', [game.id, state]);
                await this.event(client, game, 'role-deleted', null, null, null, { roleId: id, state });
            } else if (game.state !== 'retired' && game.channel_id === id) {
                await client.query("UPDATE counting_game SET state='suspended',version=version+1 WHERE id=$1", [game.id]);
                await this.event(client, game, 'suspend', null, null, null, { missing: field, id });
            }
        });
    }

}
module.exports = { CountingDAO, snapshot };
