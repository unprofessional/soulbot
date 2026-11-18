# Role counting competition

Status: Phases 1–2 merged through develop into master. Interim Phase 2.5 (guided UX) is the next priority before further gameplay features; analysis and delivery plan in `counting-guided-ux.md`. Live Discord smoke verification remains pending.

## Practical outcome

Server managers can assign multiple counting channels to different roles so those groups can compete. Each channel runs an independent counting game, and a guild leaderboard makes progress visible across teams. Launch establishes reliable counting and durable competition history; milestone bonuses and gang-warfare-style effects come later.

## Launch scope

- Configure multiple counting channels in one guild, each associated with a team role.
- Recommended initial constraint: one active counting channel per role per guild. This keeps team standings and future effect targets unambiguous. Confirm this product choice before implementation; multiple channels per role would need an explicit team scoring rule.
- Start at zero; the first accepted entry is `1`.
- Accept only the next positive whole number, posted by a human member who currently holds the assigned role.
- Disable consecutive turns by the same member by default, with a manager setting to allow them.
- Support two mistake policies: reset to zero or reject the entry while preserving progress. Make the policy visible in channel status.
- Maintain independent current counts, all-time records, and accepted-entry history per channel.
- Provide a guild leaderboard ordered by current count, with all-time records alongside it. Equal counts share a rank.

## Manager experience

Proposed guild-only `/counting` commands:

- `setup`: select an existing text channel, team role, mistake policy, and consecutive-turn policy.
- `configure`: update a game's rules or assigned role.
- `pause` / `resume`: suspend or restore counting without losing progress.
- `reset`: explicitly reset the current count while retaining the all-time record and audit history.
- `retire`: remove a game from active competition while preserving its history.
- `status`: show the channel's team, current count, record, rules, and operational state.
- `leaderboard`: compare active counting channels within the guild.

Restrict management actions to members with `ManageGuild`, checked at execution time as well as command registration. Status and leaderboard are available to members subject to channel visibility.

For launch, managers configure Discord channel permissions manually; Soulbot validates contribution eligibility independently. Report missing bot permissions during setup and status. Automatic channel permission management is a possible later convenience, not required for launch.

Changing a game's team role must require an explicit retain-history or reset-history choice. Preserve an audit trail of the reassignment even when competition history is reset. Reject duplicate active assignments according to the final role/channel constraint.

## Member experience and rules

- Confirm accepted entries with a reaction.
- Explain rejected entries briefly, including the expected number and whether the count reset.
- Delete non-counting chatter where permissions allow, without changing game state.
- Treat wrong numbers as mistakes governed by the configured policy. Reject ineligible authors, consecutive turns, and non-counting messages without resetting the team count.
- Use plain decimal integers as the counting token; expressions cannot advance the count. Optional text and image settings are defined in the parity requirements below. Edits never advance the count.
- Check role membership for each submission. Members holding multiple competing roles may contribute in each eligible channel at launch.
- Ignore bots and webhooks.
- Editing or deleting an accepted message does not roll back its recorded contribution.
- A reset starts a new run and clears the previous contributor restriction; the next accepted number is `1`.
- Keep guilds isolated, including configuration, history, standings, and management actions.

## Counting Bot parity baseline

Baseline source: the user-provided Counting Bot app-directory screenshot. This covers the advertised features and commands visible there, not an independently verified inventory of the bot. Its precise parsing, goal, pinning, and replacement semantics are not shown; the behavior below is Soulbot's proposed contract.

Parity means delivering every advertised capability below in the initial counting release alongside multi-channel role competition. Milestone rewards and attacks remain deferred. Existing items in this document describe planned behavior, not implemented features.

| Advertised capability | Previous design coverage | Gap and planned resolution |
| --- | --- | --- |
| Automatic check mark on correct numbers | Covered | Use a check mark for accepted entries; feedback failures do not change acceptance. |
| Allow/disallow additional text | Missing; integer-only input | Add per-channel `allow_text`, default false, and deterministic token parsing. |
| Allow/disallow images | Missing; attachments excluded | Add independent per-channel `allow_images`, default false. A valid counting token is still required. |
| Enable/disable counting alternation | Covered | Expose the consecutive-turn rule in settings and help. |
| Set a counting goal | Missing | Add an optional per-channel target, progress display, and one completion announcement per run/goal configuration. |
| Pin selected numbers when reached | Missing | Add a bounded list of exact numbers to pin; persist and retry failed pin actions. |
| Replace deleted/edited messages | Partial; state survived edits/deletion | Restore accepted entries visibly without accepting a second contribution or changing turns. |
| `/counting` management | Covered in proposal | Extend setup/configuration with parity settings and goal/pin management. |
| `/help` | Missing for counting | Add a counting help surface through the existing help conventions, including rules, examples, and commands. |
| `/currentcount` | Equivalent status proposed | Provide a discoverable current-count action showing the accepted count and next expected number. |
| `/settings` | Equivalent configure proposed | Provide settings inspection for members and authorized editing for managers. |
| `/topcounters` | Missing; team leaderboard only | Add per-channel contributor rankings, separate from team standings. |

Command names are reference UX, not a requirement to duplicate root commands. Prefer `/counting current`, `/counting settings`, `/counting top`, and `/counting help` or integration into existing help. Inspect command registration for collisions and permission defaults. Public read actions must remain accessible when management subcommands require `ManageGuild`; enforce management permissions per action rather than hiding the whole command group from members.

## Parity behavior contracts

### Optional text and images

- Parse a single leading base-10 positive integer token. When text is disabled, the trimmed message must contain only that token. When enabled, require whitespace between the token and trailing text; never search arbitrary text for a number.
- Require a canonical decimal representation: no signs, separators, leading zeros, decimals, or expressions. Set and document a safe maximum supported value before implementation.
- When images are enabled, accept supported image attachments accompanying a valid token; image-only posts cannot count. Reject non-image attachments. Treat Discord attachment metadata as input and do not fetch arbitrary URLs to validate counts.
- When images are disabled, reject attachment-bearing submissions without advancing or resetting. Trailing URLs are text, subject to `allow_text`; disabling image attachments does not promise to suppress Discord link previews.
- Disallowed formatting is an input rejection, not a wrong-number reset. Only an otherwise eligible, well-formed numeric attempt can invoke the mistake policy.

### Goals and automatic pins

- Store a nullable positive goal per channel. Display current/goal progress in status; reaching the goal announces completion and counting continues.
- Record completion once per run and goal configuration. Changing a goal at or below the current count reports it as already met without announcing a new achievement; resets allow a later run to achieve it again.
- Let managers add, remove, and list positive integer pin targets independently of goals. Pin the accepted message when a configured number is reached; configuration changes do not retroactively scan channel history.
- A number reached again in a new run may produce another pin. Removing a target stops future pins and does not unpin existing messages. Do not automatically evict unrelated pins when capacity is exhausted.
- Persist pending announcement/pin work alongside accepted events. Failures must be visible and retryable without counting twice. A replacement message becomes the pin target when the original no longer exists.

### Edited and deleted entry replacement

- Record each accepted entry's run, number, author, original message ID, and any replacement message ID. The database remains authoritative even when Discord history changes.
- For deletion or an edit that changes an accepted entry, post a bot-authored replacement containing the accepted number and original member attribution. Clearly identify it as a restoration and suppress mentions.
- Restore the canonical number and attribution only; do not retain or republish arbitrary trailing text or image attachments. This is visible count-history parity, not an exact copy of user media.
- An edited original is no longer authoritative; the restoration explains the accepted value. Never treat its changed number as a new attempt or count bot-authored replacements.
- Handle single/bulk deletes and uncached events using persisted IDs. Coalesce repeated events and serialize restoration with pin work. If a restoration is deleted, repair it with bounded retries and expose repeated failure instead of an endless repost loop.
- Preserve contributor totals and last-contributor state. Restoring an entry does not grant the original author another turn.
- Define outage recovery for missed edits/deletions explicitly; live event handlers alone cannot guarantee full historical repair. Provide a bounded reconciliation path and report its coverage in manager status.

### Contributor rankings

- Count accepted contributions per member per channel; exclude rejected attempts and restoration messages. Default to lifetime totals within the current game-history identity; optionally expose the current run separately.
- Resets clear run totals but retain lifetime totals. Explicit reset-history reassignment starts a new history identity so the new team does not inherit the old team's contributor rankings.
- Show equal totals as tied, paginate results, and preserve contributor IDs when members leave or lose the role. Display safe fallback labels for unavailable members.
- Apply channel visibility checks to rankings, status, and help responses that reveal channel data. Team standings remain a separate guild leaderboard.

## Repository integration and permissions

Initial inspection found no counting implementation in the searched commands, features, or event handlers. `initial_client.js` already requests the message-content intent; inspect the deployed application's intent availability as part of setup verification. Extend existing event routing for create/update/delete/bulk-delete handling without allowing other message transformations to count the same submission twice.

Do not copy the reference bot's broad permission list as a blanket requirement. Derive Soulbot's effective channel permissions from enabled features: reading messages/history, sending feedback/restorations, adding reactions, deleting invalid messages, and pinning entries. Verify current Discord API and discord.js requirements during implementation, especially pin permissions and uncached events. Role/channel/webhook management and member moderation are not required merely to assign an existing role to an existing counting channel.

Setup and status should distinguish required counting permissions from optional feature failures. Permission loss must not erase progress; missing pin or reaction access can degrade feedback, while inability to read submissions makes counting unavailable. No new channel access is granted by configuration alone.

## Implementation phases

Each phase is a separate, reviewable delivery with its own migration, commands, runtime integration, documentation, and verification where applicable. Finish a phase's exit checks before enabling its behavior. Phases 1–6 form the initial parity release; intermediate phases may be deployed for controlled use but must advertise only completed capabilities.

| Phase | Dependency | Complete usable state |
| --- | --- | --- |
| 1. Core counting | None | Multiple role channels can count reliably and managers can operate them. |
| 2. Competition views | 1 | Members can compare teams and individual contributors. |
| 2.5. Guided UX | 1–2 | First-time managers and members can set up, play, navigate, and recover without the manual. |
| 3. Flexible input | 1, 2.5 UX gate | Each channel can independently allow text and images. |
| 4. History restoration | 1, 2.5 UX gate | Accepted entries can be restored after edits/deletions. |
| 5. Goals and pins | 4, 2.5 UX gate | Goals announce completion and configured numbers are pinned, including restored entries. |
| 6. Parity release | 1–5 | The combined feature meets the full advertised parity contract. |

Phases 2 and 3 do not depend on each other or on restoration. Phase 4 owns the durable Discord-action infrastructure reused by phase 5; do not make core acceptance depend on either module. Implement [Phase 2.5 — Guided setup and everyday use](counting-guided-ux.md) next. Its usability gate is a prerequisite for Phases 3–5 unless the user explicitly reprioritizes and the roadmap is updated. It incorporates the already-planned Phase 1 lifecycle-notice follow-up. Subsequent feature phases must use its interaction and explanation patterns.

### Phase 1 — Complete core counting

**Boundary:** counting domain, persistence, create-message adapter, and essential manager/member commands. Deliver these together; do not expose setup before validation and persistence work end to end.

**Deliverables**

- Resolve role/channel cardinality, default mistake policy, supported integer range, and offline-submission policy before enabling setup.
- Add game/team identity, history identity, runs, accepted-entry ledger, administrative events, and atomic state transitions. Persist author and message IDs from the outset so later rankings/restoration need no missing historical data.
- Support multiple role-associated text channels, eligibility checks, strict integer input, alternation, both mistake policies, and reaction/rejection feedback.
- Ship setup/configure, pause/resume, reset, retire, role reassignment, status/current, read-only settings, and basic help. Help describes integer-only input and state preservation on edits/deletion; automatic restoration is not yet advertised.
- Include execution-time management authorization, member-visible read actions, visibility checks, permission diagnostics, deleted-role/channel suspension, startup recovery, duplicate-message protection, and leader/draining integration.
- Keep non-counting channels on their existing message path. Ensure counting messages are handled once and cannot also be transformed by unrelated features.

**Exit checks**

- Two role channels operate independently through normal counting, mistakes, resets, configuration changes, and restarts.
- Simultaneous and duplicate submissions cannot corrupt state; feedback failures cannot reverse acceptance.
- Unauthorized actions and cross-guild/channel access fail safely. Edits/deletions preserve accepted state even before visible restoration exists.

**Implementation notes (2026-11-17)**

- Implemented core domain/service, transactional DAO, additive `counting.sql` schema, `/counting` commands, message routing, startup/deletion reconciliation, and drain handling. See `features/counting/README.md` for operation and smoke-test steps.
- Resolved initial defaults: one non-retired game per role per guild; mistake policy `reject`; consecutive turns disabled; maximum integer `9007199254740991`; offline posts ignored using the latest connection ready/resume cutoff.
- Accepted entries and every processed attempt retain unique message IDs; reactions and cleanup occur after commit. Reassignment supports explicit retained or reset history.
- Verification: 45 targeted/regression tests passed (including command registration, role handling, and message-routing coverage); changed-file lint and whitespace checks passed. Moldy independently ran both opt-in PostgreSQL integration tests against disposable PostgreSQL 16 during PR #105 review; both passed. The author’s earlier local attempt was blocked by Docker stalling. A live Discord test-server smoke test is still required. Phase 1's release gate remains open until these checks pass.

- Review follow-up: inactive-game routing now leaves retired channels and ordinary paused/suspended chat on the normal message path; number-shaped attempts in paused/suspended games retain state feedback. State is rechecked under the transaction lock.
- Low-priority follow-up from Moldy: consider moving eligibility REST reads outside the submission transaction with appropriate revalidation, or bounding their timeout, if usage grows; they currently hold the channel lock and a pool client.

**Deployment and fallback:** register commands only with a ready schema/runtime. On initialization failure, leave counting unavailable with a clear diagnostic and preserve existing bot behavior. Pause games to disable counting; retain all records. Do not revert to a binary that cannot read the new state without a tested compatibility path.

### Phase 1 follow-up — Counting-channel availability notices

**Status:** planned; not included in the existing Phase 1 implementation. Complete this small, separately testable lifecycle module before considering Phase 1 release-ready. It depends only on core counting and does not wait for the phase 4 action worker.

**Outcome:** every configured, non-retired counting channel receives its own shutdown/restart and recovery notices so members know submissions during an interruption may be missed. These notices are automatic and independent of the server's separately configured general bot-announcement channels.

**Minimal message templates**

- Planned shutdown: `Going offline. Numbers posted while offline may be missed.`
- Planned restart: `Restarting. Numbers posted during restart may be missed.`
- Startup or reconnection: `Back online. Offline numbers may be missed. Last: 42. Next: 43.`
- Empty game recovery: `Back online. Offline numbers may be missed. Last: 0. Next: 1.`

Use persisted numbers per channel, not the latest visible Discord message. For paused/suspended games, replace `Back online.` with `Bot online; counting paused.` or `Bot online; counting suspended.` so the notice does not invite counting before a manager resumes it. At the supported maximum, replace `Next: …` with `Limit reached; reset needed.`

**Deliverables**

- Add a counting lifecycle-notice adapter alongside the core service. Reuse general announcement helpers where useful without changing their channel configuration or sending duplicate generic notices into counting channels.
- On graceful down/restart, stop taking counting submissions, finish in-flight counting transactions, attempt the corresponding notice in each counting channel, then disconnect Discord. Bound notice work by the shutdown budget; one inaccessible channel must not delay every channel or prevent shutdown.
- On startup and shard reconnection, recover/reconcile game state and establish the new offline cutoff before attempting recovery notices. Attempt each channel's notice before reopening its intake; coordinate the saved-count read with acceptance so a successful notice reflects the count at reopening.
- Preserve the existing policy that offline submissions are ignored. Notices warn of possible missed entries; they must not imply that history was replayed or automatically credited.
- Abrupt crashes, power loss, and lost Discord connections cannot reliably send a down notice. Always send a recovery notice when connectivity returns, including after an unplanned interruption.
- Coalesce ready/resume events into one recovery notice per channel per actual outage; avoid duplicates from initial shard-ready plus client-ready events. Do not send notices for retired games or count the bot's notice as an entry.
- Suppress mentions; respect guild/channel boundaries and Discord rate limits. Log and expose delivery failures in manager status. Use bounded retries and refresh saved numbers before a recovery retry. Notice delivery must not corrupt state or indefinitely block core counting or unrelated channels.

**Exit checks**

- Two channels with different counts each receive the correct last/next recovery values after startup, graceful restart, and reconnection; a new game reports 0/1.
- A submission committed immediately before draining appears in the recovery count; submissions made during downtime receive no credit.
- Shutdown notices precede client destruction; recovery notice attempts precede reopening intake. Multiple gateway lifecycle signals do not duplicate notices.
- Paused/suspended/retired games, the numeric limit, missing permissions, API failures, retry exhaustion, and partial channel delivery behave as specified.
- Discord smoke test: restart while members are counting in both channels, verify each warning and recovery message, then successfully post the announced next number.

**Deployment and fallback:** introduce no gameplay migration or counting-rule changes. Disable/retry this adapter independently if needed, retaining committed progress and the documented offline policy. Failed notice delivery remains an explicit operational failure in status, not a successful notification.

### Phase 2 — Competition and contributor views

**Boundary:** read/query module over the accepted-entry ledger, with indexed queries or rebuildable projections. It cannot mutate count acceptance.

**Deliverables**

- Add guild team standings with shared ranks, current counts, and all-time records.
- Add per-channel top contributors, pagination, lifetime totals, and current-run totals using the existing ledger.
- Respect history reassignment, departed-member attribution, channel visibility, and guild isolation. Extend help and status links.
- If storing aggregates, backfill from phase 1 data before enabling views and update them transactionally or expose projection freshness explicitly.

**Exit checks**

- Rankings match accepted entries across mistakes, resets, ties, departure, and role/history reassignment.
- Private channels do not leak through standings or explicit channel arguments. Pagination is stable under the documented ordering.

**Implementation notes (2026-11-17)**

- Added a separate read-only views DAO/module, `/counting leaderboard [page]`, and `/counting top [channel] [scope:lifetime|run] [page]`, with help/status discovery.
- Standings include active/paused/suspended games and exclude retired games. Contributor history remains readable for a retired game if its channel is accessible.
- Refresh channel overwrites, role permissions, and requester membership. Require View Channel and Read Message History; filter channels before ranking so hidden games cannot affect ranks or page counts. Replies are ephemeral and suppress mentions.
- Ten entries per page, shared competition ranks (1, 1, 3), deterministic ID ordering for ties. Page requests show live results rather than a frozen cross-request snapshot; disclose that progress can move entries between pages.
- Query the accepted-entry ledger directly with one statement per view, joining current history/run in the same snapshot. No aggregate backfill or acceptance hooks. Lifetime totals survive ordinary resets and retained-history reassignment; reset-history reassignment starts empty.
- Initialize the optional accepted-entry index separately from core schema readiness. View initialization/query failure cannot disable core counting.
- Unit/command/privacy coverage and a disposable-PostgreSQL scenario cover ties, pagination, guild/channel isolation, resets, retirement, rejected/duplicate attempts, and both reassignment choices. Validation results are recorded with the PR; live Discord smoke testing remains required.
- Verification: 51 counting tests pass; changed-file lint and whitespace checks pass. Full-suite verification runs in the commit hook. The author run skipped three opt-in PostgreSQL tests because Docker timed out; Moldy subsequently independently verified all 3/3 on a disposable database in PR #107 and approved it. Live Discord testing remains pending.
- The Phase 1 lifecycle-notice follow-up remains planned and is separate from this phase.

**Deployment and fallback:** existing ledger data is queryable immediately after view initialization; no backfill is needed. View initialization failure disables only ranking commands. Preserve the existing ledger/index when reverting the optional module; core counting and stored contributions remain usable.

### Interim Phase 2.5 — Guided setup and everyday use

**Priority:** next, before additional gameplay features. [Detailed audit, examples, modular deliveries, and usability gate](counting-guided-ux.md).

The source audit found generic command descriptions, identical current/settings/status responses, ambiguous defaults/history options, misleading role-assignment wording, generic success messages, and missing recovery/navigation guidance. This phase makes the existing feature understandable without reading the manual.

Deliver four independently functional steps: **2.5A** clear language, distinct read views, and an explicit channel/team/eligibility discovery list; **2.5B** guided setup and safe management confirmations; **2.5C** navigation and understandable rankings; **2.5D** operational clarity, the existing lifecycle notices, and first-time-user verification. Preserve slash names, gameplay rules, counts, and history.

**Exit:** a new manager can set up two competing teams, and a new member can find the next number, understand their turn, recover from errors, and browse standings without external documentation. Privacy, transaction safety, and legacy command behavior remain covered. Live Discord usability verification is required; a rewritten help paragraph alone does not close this phase.

### Phase 3 — Configurable text and image input

**Boundary:** deterministic input parser and per-game settings, used before the unchanged acceptance transaction.

**Deliverables**

- Add independent `allow_text` and `allow_images` settings with false defaults for existing/new games.
- Implement the canonical-token and attachment rules in the parity contracts; distinguish malformed input from a valid wrong-number attempt.
- Expose configuration, effective settings, examples, and rejection messages together.

**Exit checks**

- All four switch combinations accept/reject the intended messages without affecting unrelated channels.
- Expressions, ambiguous tokens, unsupported attachments, and image-only posts cannot count; formatting rejection never resets progress.
- Changing settings takes effect consistently with queued submissions; record the configuration version or serialize changes with acceptance.

**Deployment and fallback:** additive settings preserve phase 1 behavior by default. Managers can disable both options without a data migration or loss of count history.

### Phase 4 — Durable history restoration

**Boundary:** edit/delete adapters, canonical-entry lookup, and a persistent Discord-action worker. Core counting only records accepted entries; restoration never invokes acceptance.

**Deliverables**

- Add a durable action queue with stable action keys, bounded retries/backoff, leader/draining support, operational status, and manual retry controls. Store work atomically with the event that requires it.
- Track original and replacement message IDs and current authoritative visible entry. Restore canonical numbers/attribution with mentions suppressed.
- Handle updates, single/bulk deletions, uncached events, duplicate delivery, and deleted replacements without repost loops.
- Provide bounded outage reconciliation with documented coverage and a manager-visible result. Earlier phase 1 entries are eligible using their stored IDs; do not claim complete recovery beyond the reconciliation window.
- Define Discord-send crash recovery: a successful send followed by a failed database acknowledgement must be reconciled or surfaced as ambiguous, not blindly retried as if Discord provided exactly-once delivery.

**Exit checks**

- Restoration preserves count, last contributor, run, and contributor totals under every supported event path.
- Crashes before/after external calls, permission loss, stale work, and repeated deletion produce bounded, inspectable behavior.
- The worker drains or pauses safely; disabling restoration leaves counting fully operational and history intact.

**Deployment and fallback:** initialize mappings and worker readiness before advertising restoration. Allow restoration/reconciliation to be paused separately from counting; preserve pending actions for safe resumption.

### Phase 5 — Goals and configured-number pins

**Boundary:** milestone evaluation and Discord-action handlers. Depends on phase 4's durable worker and authoritative message mapping, not on rankings or flexible input.

**Deliverables**

- Add nullable goals, bounded pin-target configuration, add/remove/list commands, and member-visible progress/settings.
- Evaluate milestones from accepted transitions and persist uniquely keyed work in the same transaction. Apply the documented run/configuration semantics.
- Announce goal completion without stopping counting. Pin the authoritative accepted/restored entry; preserve intended pin status if that entry must later be restored.
- Expose failed announcements/pins and retry controls; respect permission loss and pin capacity without evicting unrelated pins.
- Keep gameplay rewards and attacks absent from this module.

**Exit checks**

- Goal changes, resets, repeated target values across runs, duplicate events, and restarts follow the parity contracts without duplicate logical awards.
- Pinning and restoration converge on the current visible entry regardless of event order. Removed targets and retired games follow an explicit pending-action policy.
- Milestone side-effect failures never block or undo counting; ambiguous sends follow phase 4 recovery rules.

**Deployment and fallback:** existing games have no goal or pin targets by default. Disable milestone evaluation/dispatch independently while retaining configuration, accepted counts, and pending work; document whether pending actions resume or are cancelled on re-enable.

### Phase 6 — Integrated parity release

**Boundary:** release qualification and operational documentation. This phase must not defer correctness checks needed by an earlier phase.

**Deliverables**

- Run the complete parity matrix in two role channels with different settings and verify all module interactions.
- Verify an upgrade from phase 1 data, restart with pending restoration/pin actions, permission degradation/recovery, private-channel queries, and disabling each optional module while counting continues.
- Document commands, mistake/input rules, outage/reconciliation limits, permission diagnostics, and recovery procedures. Confirm help matches only enabled capabilities.
- Declare screenshot parity complete only after every capability and the global acceptance criteria pass. Keep future warfare work in a separate plan.

**Exit checks:** all earlier phase checks and integrated acceptance criteria pass; no pending schema/backfill dependency, placeholder command, or required manual database repair remains.

## Module and migration rules

- Keep command/event adapters thin. Separate counting state transitions, input parsing, read queries, history restoration, milestone evaluation, and Discord-action dispatch behind explicit interfaces.
- Share stable guild/game/history/run/entry identifiers. Domain events include the accepted number, author/message IDs, and configuration version needed by consumers.
- Add schema changes and defaults before enabling their consumers. Make backfills resumable and idempotent; never reconstruct accepted history by trusting arbitrary Discord messages.
- Every optional module must tolerate being disabled or temporarily failing. Count validation and commits remain the responsibility of the core module.
- Define how pause, retirement, history reset, and configuration changes affect pending actions before enabling each action type. Recheck game/history identity when executing stale work so archived entries cannot affect a reassigned team's current game.
- Keep phase-specific tests and smoke checks in the phase that introduces the behavior. The final release gate checks integration rather than discovering unfinished fundamentals.

## Persistence and implementation approach

Inspect the existing command registration, message listener, store/DAO, database migration, and startup/shutdown patterns before choosing implementation files.

Persist guild, game/channel, and team-role identifiers; rules; active/paused/retired state; current count; all-time record; current run; and last accepted contributor/message. Record accepted counts, mistakes that reset a run, and administrative changes as durable game events.

Process submissions in a consistent order per game and update state atomically. Enforce uniqueness by Discord message ID so duplicate delivery cannot advance a game twice. Coordinate with the application's existing leader/draining behavior; in-memory queues alone must not be the durability guarantee.

Commit accepted state before sending reactions or other feedback. A Discord feedback failure must not undo an accepted count. Recover persisted state after restart; do not silently reset games or count old messages again. Define and communicate the outage policy before launch, including whether submissions made while the bot is offline are ignored or replayed.

If a configured role or channel is deleted, suspend the affected game, preserve history, and expose the issue in manager status. Missing permissions should produce actionable status and logs. Leaderboard queries must respect viewer access to private counting channels.

## Future milestone bonuses and effects

Keep team identity, counting games, and game events distinct so future effects can target a team without rewriting counting history. Launch needs durable events, not an effect engine or inventory system.

Example future mechanic: a team reaches 1,000 and earns an effect that restricts another team's ability to count for one day. The exact punishment and activation rules remain future product work.

Before introducing effects, define:

- Milestone eligibility and whether rewards recur after a reset or in a new season.
- Who chooses targets and activates earned effects.
- Duration, cooldowns, stacking, protection, and counterplay.
- Whether restrictions affect one game or the whole team.
- Reliable expiration across restarts, manager overrides, and an audit trail.
- Whether future membership rules prevent players from helping opposing teams.

Prefer enforcing effects in counting validation with persisted expiry times. Keep effects separate from Discord role and channel permission mutations so expiry and manager reversal stay predictable.

Out of scope for launch: bonuses, attacks, currencies, inventories, alliances, seasons, and automated permission management.

## Phase completion checklist

- [ ] Phase 1: core counting and essential operation complete; exit checks pass.
- [ ] Phase 1 follow-up: per-channel down/restart/up notices complete; lifecycle and Discord checks pass.
- [ ] Phase 2: team/contributor views complete; exit checks pass.
- [ ] Phase 2.5: guided UX steps A–D complete; first-time-user Discord gate passes.
- [ ] Phase 3: flexible input complete; exit checks pass.
- [ ] Phase 4: durable restoration complete; exit checks pass.
- [ ] Phase 5: goals and pins complete; exit checks pass.
- [ ] Phase 6: integrated parity release qualified and documented.

## Verification and acceptance criteria

- A manager can configure at least two role-associated channels in one guild and manage each independently.
- Eligible members advance only the relevant game; wrong roles, bots, webhooks, malformed input, and consecutive turns follow the documented rules.
- Both mistake policies, resets, pauses, retirement, role reassignment, and deleted configuration targets behave as specified.
- Concurrent and duplicate submissions cannot double-count or lose accepted progress.
- Edits/deletions and feedback API failures do not corrupt durable state.
- Restart recovery preserves counts, records, last contributor, and history according to the agreed outage policy.
- Each non-retired counting channel gets graceful down/restart warnings and concise startup/reconnection notices with its saved last and next numbers; unplanned outages still produce recovery notices when possible.
- Leaderboards reflect accepted counts and resets, handle ties, isolate guilds, and preserve private channel visibility.
- Management permission checks prevent unauthorized configuration changes.
- A test-server smoke test demonstrates two teams counting independently and competing on the leaderboard.
- Every row of the screenshot parity matrix has an implemented, documented equivalent.
- Text/image settings cover all four combinations; malformed tokens and disallowed attachments cannot advance or reset a game.
- Goals announce once under the stated run/configuration rules; pin targets work across resets and report permission/capacity failures.
- Edited, deleted, bulk-deleted, uncached, and repeatedly delivered events preserve one accepted contribution and restore canonical entries within the stated recovery coverage.
- Restorations never increment counts or contributor totals; pin work follows the authoritative visible entry.
- Contributor rankings distinguish lifetime and run totals, survive ordinary resets, and honor history reassignment and channel privacy.
