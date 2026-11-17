# Role counting — Phase 1

Managers use `/counting setup channel:#team role:@team`. Channel access is configured manually; Soulbot checks current team membership for every attempt. One non-retired counting game per role per guild is allowed. A channel retains its game record after retirement and can be configured/resumed instead of set up again.

Defaults: start at 1, alternate members, reject incorrect numbers while preserving progress. Managers can select `mistakes:reset` or enable `consecutive`. Only canonical positive decimal integers through 9007199254740991 count; whitespace around the number is allowed. Text, images, expressions, bots, and webhooks do not count. Invalid formatting, missing team membership, or consecutive turns never reset progress.

- `/counting current`, `status`, `settings`, `help`: member-visible, ephemeral responses; channel visibility checked.
- `/counting configure`: edit rules or team role. Changing the role requires `history:retain` or `history:reset`; reset starts a new history and clears count/record, preserving archived events.
- `/counting pause`, `resume`, `reset`, `retire`: require Manage Server. Reset preserves the record and starts a new run with no last contributor. Resume validates the role and bot permissions again.

Soulbot needs View Channel, Read Message History, Send Messages, and the Message Content gateway intent. Add Reactions and Manage Messages enable reactions and invalid-message cleanup. Missing optional permissions do not undo accepted counts. Losing required channel permissions stops acceptance until access returns. Deleted roles/channels suspend the game; startup reconciliation and status also detect missing targets. Fix the target and resume explicitly.

The PostgreSQL schema is initialized additively from `store/db/tables/counting.sql` before command registration. It has no dependency on the generic guild/member tables. Failed counting schema initialization disables counting commands without preventing unrelated bot startup. Existing games recover from database state automatically. Do not downgrade to code that writes incompatible counting state.

Per-channel transactions and advisory locks coordinate submissions and manager actions. Every processed message has a unique durable event, including reset-causing mistakes; duplicate delivery cannot apply the action twice. Feedback is best effort after commit. The existing application leader lock remains responsible for single-leader operation; counting work drains before database cleanup.

Posts created before the current connection's ready/resume time are ignored rather than replayed. Posts during downtime do not earn credit. Edits and deletions do not alter recorded progress; visible restoration is a later phase. A failed submission transaction leaves the expected count unchanged: check `/counting current` and send a new message. Retired games use normal message processing. Paused/suspended games reply only to attachment-free decimal-number attempts; other chat keeps normal logging and transformations. Counting messages bypass unrelated transformations and generic message logging; accepted numbers, author/message IDs, and administrative events are retained in the counting ledger.

Team/contributor rankings, flexible input, restoration, goals, pins, and warfare effects are not implemented in Phase 1.

## Verification

Run `npx jest tests/counting*.spec.js --runInBand` and lint changed JavaScript files. Database integration tests require `COUNTING_TEST_DATABASE_URL` pointing to a disposable PostgreSQL database; **the suite drops the counting tables in that database**. Never use the application database. Without this variable, database integration tests are skipped.

Before production release, use a Discord test server to:

1. Set up two text channels and two normal team roles; configure manual role/channel access.
2. Alternate two eligible members, try outsiders and bots, then exercise both mistake policies and consecutive turns.
3. Pause/resume/reset/retire; change roles with each history option; verify private-channel queries and manager-only actions.
4. Restart and confirm count, record, last contributor, and ignored offline messages. Remove reaction/cleanup permissions, then required permissions, and check degradation/recovery.
5. Edit/delete accepted entries and confirm state is unchanged. Delete a configured role and verify suspension and diagnostics.

The initial full parity launch remains gated on later phases and the Discord smoke test.
