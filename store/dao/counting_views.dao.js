const { pool } = require('../db/pool.js');
const PAGE_SIZE = 10;
function pageOffset(page) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new Error('Choose a page between 1 and 1000000.');
    return (page - 1) * PAGE_SIZE;
}
// Read-only views use one statement/snapshot each; no aggregate backfill or write-path hooks.
class CountingViewsDAO {
    constructor(db = pool) { this.db = db; }
    async leaderboard(guildId, visibleChannelIds, page = 1) {
        const offset = pageOffset(page);
        const result = await this.db.query(`
            WITH ranked AS (
                SELECT channel_id, role_id, state, current_count, record,
                       RANK() OVER (ORDER BY current_count DESC) AS place
                FROM counting_game
                WHERE guild_id=$1 AND channel_id=ANY($2::text[]) AND state <> 'retired'
            )
            SELECT (SELECT COUNT(*)::text FROM ranked) AS total,
                   COALESCE((SELECT json_agg(entries) FROM (
                       SELECT channel_id, role_id, state, current_count::text, record::text, place::text
                       FROM ranked ORDER BY current_count DESC, channel_id ASC LIMIT $3 OFFSET $4
                   ) entries), '[]'::json) AS entries`, [guildId, visibleChannelIds, PAGE_SIZE, offset]);
        return result.rows[0];
    }
    async top(guildId, channelId, scope = 'lifetime', page = 1) {
        if (!['lifetime', 'run'].includes(scope)) throw new Error('Choose lifetime or run totals.');
        const offset = pageOffset(page);
        const result = await this.db.query(`
            WITH target AS (
                SELECT id, history_id, run_id, state FROM counting_game WHERE guild_id=$1 AND channel_id=$2
            ), scores AS (
                SELECT e.author_id, COUNT(*) AS contributions
                FROM counting_event e JOIN target g ON e.game_id=g.id AND e.history_id=g.history_id
                WHERE e.kind='accepted' AND e.author_id IS NOT NULL AND ($3='lifetime' OR e.run_id=g.run_id)
                GROUP BY e.author_id
            ), ranked AS (
                SELECT author_id, contributions, RANK() OVER (ORDER BY contributions DESC) AS place FROM scores
            )
            SELECT g.history_id::text, g.run_id::text, g.state,
                   (SELECT COUNT(*)::text FROM ranked) AS total,
                   COALESCE((SELECT json_agg(entries) FROM (
                       SELECT author_id, contributions::text, place::text FROM ranked
                       ORDER BY contributions DESC, author_id ASC LIMIT $4 OFFSET $5
                   ) entries), '[]'::json) AS entries
            FROM target g`, [guildId, channelId, scope, PAGE_SIZE, offset]);
        return result.rows[0];
    }
}
module.exports = { CountingViewsDAO, PAGE_SIZE };
