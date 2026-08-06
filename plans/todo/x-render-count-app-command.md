# X Render Count App Command

Status: todo.

## Practical outcome

A user can ask Soulbot how many X posts it successfully rendered on behalf of themselves or another member. FIXUPX fallbacks do not inflate the result.

## Proposed behavior

- Add a guild-only `/x-post-count` app command with an optional user argument that defaults to the caller.
- Report the user's global total across every guild where Soulbot handled their posts, matching the requested all-posts count rather than silently limiting it to the current server.
- Count successful persisted webhook render records attributed to the selected user, using ownership metadata such as `kind: twitter_render`, `owningUserId`, and `originalLink`.
- Include successful image, video, and cached-render deliveries because each produced a Soulbot-rendered X post for that user's submission.
- Exclude FIXUPX replies, failed renders, progress messages, ordinary X links, and non-X webhook replacements.
- Count historical successful renders even if the resulting Discord message was later deleted, provided its ownership record remains in the database.
- Audit data from before render-ownership metadata was introduced. Backfill only where attribution and successful attachment delivery can be established reliably; do not guess or silently present a partial count as all-time.
- Add the DAO query and index support needed to avoid scanning the full message table for each command invocation.
- Return a concise, non-ephemeral result suitable for sharing in-channel.

## Verification

- Query tests covering successful images, successful videos, cached deliveries, deleted renders, FIXUPX fallbacks, failed renders, and unrelated webhook messages.
- Verify the same user ID is aggregated correctly across multiple guilds without combining different users.
- Confirm the query uses an index-backed plan on production-shaped data.
- Compare command totals with a hand-audited production sample before release.
