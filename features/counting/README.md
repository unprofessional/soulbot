# Counting games — guided UX (Phases 1–3; channel teams)

Use `/counting help` in any server channel. Members get their readable teams, whether they can count, and buttons to open the next-number view. Managers also get the preparation checklist. The basic instructions remain available when game data cannot be loaded; help says when its channel list is unavailable.

## Set up a competition

1. Each counting channel is a team. Choose existing roles such as squad and mod, or create/assign roles in Discord. At least two humans across the allowed roles are needed for default take-turn play.
2. Prepare a dedicated normal text channel for each team. Grant participating roles View Channel, Read Message History, and Send Messages. Configure team-only access yourself if desired; other overrides can grant access. Test as ordinary members, since owners/administrators bypass restrictions.
3. Give Soulbot those same three channel permissions. Add Reactions enables check marks; Manage Messages enables invalid-post cleanup. Soulbot does not assign roles or edit permissions.
4. **Enter the target channel** and run `/counting setup role:@RedTeam`, selecting the real role in the option picker. Role is the only setup option. Review the defaults and confirm Start counting within two minutes. For more eligible roles, run `/counting role-add role:@mod` in that same channel and confirm. Repeat for up to ten roles total. Another channel may allow the same roles.
5. Check `/counting status`, check ordinary-member access, and explicitly choose Post channel guide. One teammate posts 1 and a different teammate posts 2. Use `/counting leaderboard` to compare teams.

Defaults: start at 1; teammates take turns; wrong numbers preserve progress. Use `/counting configure` later to change rules. One game per guild/channel is supported; roles can participate in any number of channels. A retired channel keeps its game record; configure/resume it rather than running setup again.

## Play and understand the rules

- `/counting current`: saved last/next number and whether it is your turn.
- `/counting settings`: this channel's actual rules, including what mistakes do.
- `/counting status`: whether it is working. Managers also see named missing permissions and repair steps; bot readiness does not verify member access/team isolation.
- `/counting leaderboard [page]`: non-retired teams ranked by current count, with best counts and readable game state.
- `/counting top [channel] [scope] [page]`: accepted contributions for the current team history (default `lifetime`) or since the last restart at 1 (`run`). A bot restart does not restart a run.

Read views are private and have navigation buttons; commands still work without buttons. Choose an optional channel on read/management commands to inspect another readable game. Setup always uses the invoking channel. Buttons expire after two minutes or a bot restart; reopen help/the command to get fresh controls.

Only canonical positive decimal integers through 9007199254740991 count (surrounding whitespace is allowed). Text, images, expressions, bots, and webhooks do not count. Bad formatting, missing team membership, and consecutive turns never reset progress. Edited/deleted accepted messages keep their recorded contribution; visible restoration is not implemented yet. A member holding any one allowed role can play for that channel. Multiple matching roles never grant extra credit or turns.

Rankings use 10 entries per page and shared competition places (1, 1, 3). Equal totals have stable ID ordering; results are live, so progress can move entries between requests. Only channels with View Channel and Read Message History participate in your results, including ranks/page totals. Role, member, and channel permissions are refreshed on reads and button actions. Unavailable contributors keep their totals and display an ID label. Mentions never ping anyone.

## Manager controls

Manage Server is required at execution and again on confirmation. Preparation may require additional Discord permissions; ask an administrator if you cannot create roles/channels.

- `/counting configure` without changes shows the rules/editor. Set `mistakes:reset` to restart at 1 after a wrong number; set `consecutive:true` to allow back-to-back turns. Omitted settings stay unchanged. A preview explains supplied changes.
- `/counting role-add role:…` and `/counting role-remove role:…`, inside the target channel, edit its eligibility list with a confirmation. Maximum ten distinct roles; add a replacement before removing the last role. Counts, best, turns, runs, and contributor history always stay intact. Repeated adds/removing an unlisted role are harmless.
- Configure changes rules only. Old configure role/history options are retired; use the role commands. A channel stays the same team regardless of who is eligible.
- `/counting pause` preserves progress; `/counting resume` checks prerequisites and continues.
- `/counting reset` previews starting at 1, preserving the best count and lifetime totals while clearing current-run totals and the previous contributor restriction.
- `/counting retire` previews removal from standings and restoration of normal chat, with history preserved. Resume reactivates the game.

Reset, retire, allowed-role/rule changes, and new setup need confirmation. Cancel/expired previews change nothing. A confirmation compares the displayed game/history/run/configuration/allowed-role/count/last-entry state under the same database lock as counting. Changed data requires a new preview/confirmation; pause a busy game first if needed. Duplicate clicks cannot replay the action. Restart safely expires pending previews.

Post channel guide is a separate explicit manager action available after setup and in the rules/status views. It publishes static rules, not a soon-stale next number. Regenerate it after rule changes; its posting date and the settings command identify the authoritative current rules. It never auto-pins. Failed guide publication does not undo the game; inspect the channel before retrying an uncertain send.

## Downtime and recovery

Each non-retired counting channel gets its own graceful offline/restart warning. After startup/reconnection, Soulbot reads saved state and attempts:

> Back online. Offline numbers may be missed. Last: 42. Next: 43.

Paused/suspended games are identified accordingly; the numeric limit asks for a reset. Offline submissions are ignored. Channel intake is gated during recovery attempts and reopens with a fresh timestamp cutoff, so missed posts are not silently replayed. Recovery is serialized with counting/management and does not gate unrelated shards. General server announcements skip these channels to avoid duplicates.

The first observed counting failure attempts a channel warning immediately. Repeated warnings are suppressed per outage, with at most one reminder per minute; failed sends have at most three attempts. Uncertain database acknowledgements say acceptance could not be confirmed, rather than claiming the count failed. Check current before trying again. Manager status exposes failed notices; a verified recovery resets warning suppression.

Notices are best effort. A crash or broken Discord connection cannot send an advance warning. Inaccessible configuration at startup can prevent discovery of channels to notify. Recovery scan/sends have bounded retries and deadlines; optional notice failure never resets or indefinitely blocks counting. Timed-out Discord sends can be ambiguous; nonces help deduplicate retries, but do not provide durable exactly-once delivery. A delayed notice is a saved snapshot, so check current before posting. Shutdown notice work has a five-second budget after counting drains, before Discord/database cleanup.

## Persistence and operation

`store/db/tables/counting.sql` initializes additively before counting commands are registered. Existing games need no setup rerun or reset. The Phase 3 migration seeds their original role into `counting_allowed_role`, preserves every game/event/history/run ID and score, and removes the old role ownership column/index. Migration runs only after acquiring the leader lock, when the prior leader has drained, before command registration/login. Keep a backup before production upgrade; a pre-migration binary cannot safely run against the new schema. PostgreSQL transactions/advisory locks serialize submissions and manager writes; unique message IDs deduplicate accepted entries and mistakes. Feedback is best effort after commit. The application leader lock remains responsible for single-leader operation; slash/component/counting work drains before channel shutdown notices and database cleanup.

The optional `counting_views.sql` index initializes separately; failure disables rankings, not count acceptance. Views read accepted ledger entries directly with one statement per response; no aggregate backfill is needed. Ordinary resets clear run totals but preserve lifetime totals; eligibility edits never change channel history. Previously archived histories stay archived.

Retired games use normal message processing. Paused/suspended games explain numeric attempts without deleting them; other chat retains normal logging/transformations. Active counting messages bypass unrelated transformations and generic message logging; the counting ledger retains accepted number, author/message IDs, and audited administrative actions. A deleted allowed role is pruned without stopping a game that has another eligible role. Losing the final role or channel suspends counting; add a replacement role and resume explicitly. Discord access is still configured manually.

Text/image input options are deferred as an optional post-production enhancement; pure numbers remain the production behavior. Restoration, goals/pins, effects, and live topic/pinned status displays remain later work.

## Verification and Discord usability gate

Run counting tests and changed-file lint. Opt-in integration requires `COUNTING_TEST_DATABASE_URL` pointing only to a **disposable database**: the suite drops its counting tables. Without it, six PostgreSQL tests are skipped. Never use the application database.

Before release, have a manager and members who have not read this document test:

1. Start without prepared roles/channels. Find help, create two teams, assign two teammates each, set team/bot access, enter each channel, preview/confirm role-only setup, and publish guides. Repeat with existing resources and missing creation permissions.
2. As a member in another channel, discover readable teams, identify missing roles/access versus waiting for a teammate, navigate to current/rules, and post the announced next number. Test bad formatting and both mistake/turn rules.
3. Cancel and expire management previews. Count/reset/edit allowed roles during a preview and prove stale confirmations cannot overwrite unexpected progress. Try another user's controls and revoke permissions before confirming.
4. Verify squad-only and mod-only members share one sequence, a dual-role member cannot take two turns, outsiders cannot count, and the same role can play in another channel. Compare team/contributor rankings, switch periods, browse page 2 and an invalid page, and check empty/deleted-role/departed-member cases. Hide a channel and deny history; it must not affect discovery, ranks, totals, or navigation.
5. Pause/resume/reset/retire and change teams with both history choices; verify what is preserved. Repeated buttons do not repeat writes; guide failure preserves the game.
6. Restart while both channels count: warnings precede disconnect, recovery shows each saved last/next value, and offline posts are ignored. Repeat with permission loss, failed/uncertain notice delivery, reconnect, and recovery of one shard without blocking another.
7. Inspect narrow/mobile layouts. Identify and resolve misunderstandings before closing Phase 2.5's usability gate.

Automated checks do not replace this live Discord gate.
