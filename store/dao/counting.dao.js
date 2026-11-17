const { pool } = require('../db/pool.js');
const { evaluate } = require('../../features/counting/domain.js');
const normalize = row => row && ({ ...row, current_count: Number(row.current_count), record: Number(row.record) });
class CountingDAO {
    constructor(db = pool) { this.db = db; }
    async get(guildId, channelId) {
        const result = await this.db.query('SELECT * FROM counting_game WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
        return normalize(result.rows[0]);
    }
    async transaction(guildId, channelId, fn) {
        const client = await this.db.connect();
        try {
            await client.query('BEGIN');
            // Serializes setup, configuration, and submissions even when a game does not yet exist.
            await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`counting:${guildId}:${channelId}`]);
            const result = await client.query('SELECT * FROM counting_game WHERE guild_id=$1 AND channel_id=$2 FOR UPDATE', [guildId, channelId]);
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
            if (action === 'setup') {
                if (game) throw new Error('This channel already has a game; configure or resume it instead.');
                const result = await client.query(`INSERT INTO counting_game(guild_id,channel_id,role_id,mistake_policy,allow_consecutive)
                    VALUES($1,$2,$3,$4,$5) RETURNING *`, [guildId, channelId, options.roleId, options.policy || 'reject', options.consecutive || false]);
                game = normalize(result.rows[0]);
            } else {
                if (!game) throw new Error('No counting game is configured here.');
                if (action === 'configure') {
                    if (options.roleId && options.roleId !== game.role_id && !options.history) throw new Error('Choose retain or reset history when changing teams.');
                    if (options.history === 'reset' && options.roleId && options.roleId !== game.role_id) {
                        await client.query('UPDATE counting_game SET history_id=history_id+1,run_id=run_id+1,current_count=0,record=0,last_author_id=NULL,last_message_id=NULL WHERE id=$1', [game.id]);
                    }
                    await client.query(`UPDATE counting_game SET role_id=COALESCE($2,role_id),mistake_policy=COALESCE($3,mistake_policy),allow_consecutive=COALESCE($4,allow_consecutive),version=version+1 WHERE id=$1`,
                        [game.id, options.roleId ?? null, options.policy ?? null, options.consecutive ?? null]);
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
        // Field is selected internally, never taken from Discord input.
        if (!['role_id', 'channel_id'].includes(field)) throw new Error('Invalid target');
        const result = await this.db.query(`SELECT channel_id FROM counting_game WHERE guild_id=$1 AND ${field}=$2 AND state <> 'retired'`, [guildId, id]);
        for (const row of result.rows) await this.transaction(guildId, row.channel_id, async (client, game) => {
            if (!game || game.state === 'retired' || game[field] !== id) return;
            await client.query("UPDATE counting_game SET state='suspended',version=version+1 WHERE id=$1", [game.id]);
            await this.event(client, game, 'suspend', null, null, null, { missing: field, id });
        });
    }
}
module.exports = { CountingDAO };
