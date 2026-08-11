const { pool } = require('../db/pool.js');

class MemberEventDAO {
    async record({
        guildId,
        memberId,
        eventType,
        username = null,
        globalName = null,
        displayName = null,
    }) {
        const sql = `
            WITH prior_joins AS (
                SELECT COUNT(*)::integer AS count
                FROM member_guild_event
                WHERE guild_id = $1
                  AND member_id = $2
                  AND event_type = 'join'
            ),
            inserted AS (
                INSERT INTO member_guild_event (
                    guild_id,
                    member_id,
                    event_type,
                    username,
                    global_name,
                    display_name
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, guild_id, member_id, event_type, occurred_at
            )
            SELECT
                inserted.*,
                CASE
                    WHEN inserted.event_type = 'join' THEN prior_joins.count + 1
                    ELSE NULL
                END AS join_count
            FROM inserted
            CROSS JOIN prior_joins
        `;

        const result = await pool.query(sql, [
            guildId,
            memberId,
            eventType,
            username,
            globalName,
            displayName,
        ]);
        return result.rows[0] || null;
    }
}

module.exports = MemberEventDAO;
