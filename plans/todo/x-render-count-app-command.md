# X Render Count App Command

Status: todo.

## Practical outcome

A user can ask Soulbot how many X posts it successfully rendered on behalf of themselves or another member during a recent rolling window. FIXUPX fallbacks do not inflate the result.

## Level of effort

Small to medium — approximately 1–1.5 engineer-days, including the indexed aggregate query, app command, rolling-window validation, automated coverage, and a production-data spot check. This estimate assumes the existing render-ownership metadata is complete for the requested seven-day maximum and no historical backfill is needed.

## Proposed behavior

- Add a guild-only `/x-post-count` app command with an optional user argument that defaults to the caller.
- Add an optional `period` argument with fixed choices of `24 hours`, `5 days`, and `7 days`; default to `24 hours`.
- Treat every period as a rolling duration back from command execution, not as calendar-day boundaries.
- Report the user's global total across every guild where Soulbot handled their posts, matching the requested all-posts count rather than silently limiting it to the current server.
- Count successful persisted webhook render records attributed to the selected user, using ownership metadata such as `kind: twitter_render`, `owningUserId`, and `originalLink`.
- Include successful image, video, and cached-render deliveries because each produced a Soulbot-rendered X post for that user's submission.
- Exclude FIXUPX replies, failed renders, progress messages, ordinary X links, and non-X webhook replacements.
- Count successful renders inside the selected window even if the resulting Discord message was later deleted, provided its ownership record remains in the database.
- Add the DAO query and index support needed to avoid scanning the full message table for each command invocation.
- Return a concise, non-ephemeral result that names the selected user and period and is suitable for sharing in-channel.

## Verification

- Query tests covering successful images, successful videos, cached deliveries, deleted renders, FIXUPX fallbacks, failed renders, and unrelated webhook messages.
- Boundary tests for exactly 24 hours, 5 days, and 7 days, including the default period and records immediately inside and outside each rolling cutoff.
- Verify the same user ID is aggregated correctly across multiple guilds without combining different users.
- Confirm the query uses an index-backed plan on production-shaped data.
- Compare command totals with a hand-audited production sample before release.
