# Counting — reply to offline numbers with the next number; kill the recovery broadcast

Status: implemented on `fix/counting-offline-number-feedback`; review and live Discord reconnect verification pending. No schema change or production deployment in this branch.

## Problem

Two defects in the counting recovery path, both observed live on 2026-11-18:

1. **Broadcast spam.** Every gateway reconnect posts "Back online. Offline numbers may be missed. Last: X. Next: Y." into every counting channel. The shard reconnects routinely (Discord gateway load rebalancing, heartbeat zombie detection, network blips), so this fired 6+ times in ~9 hours across the three channels while the count never changed. It is noise.

2. **Silent drop.** A number posted while the bot is offline is dropped without feedback. The poster gets no checkmark and usually no explanation, so they cannot tell their number was missed or what to post next.

## Root cause (verified at source, develop @ 357ef70)

- `features/counting/service.js` `processMessage` (~line 55): `if (message.createdTimestamp < Math.max(onlineSince, notices.cutoff(...))) return true;` — any number older than the recovery cutoff is ignored silently. This is a **deliberate anti-double-count fail-safe** (comment: "Never replay old submissions after startup, including delayed duplicate gateway events"). It drops gap numbers on EVERY reconnect, including clean resumes, because `recover()` resets the cutoff to "now" each time. The count stays intact and continues from the last accepted number; the only loss is the offline poster's contribution.
- `features/counting/notices.js` `recoveryAttempt` (~line 127-130) sends the "Back online…" broadcast. `features/counting/service.js` (~line 114-120) wires it to BOTH `Events.ShardResume` and `Events.ShardReady` via `notices.recover(id)`, plus the initial `ClientReady` → `recover()`. Resume and re-identify are not distinguished, and neither needs a broadcast.

The drop is correct and must stay. The two defects are the **broadcast** and the **silence**, not the drop itself.

## The change

### Part A — remove the recovery broadcast (full silence)

Stop sending the proactive per-channel recovery notice ("Back online…" / "Bot online; counting paused/suspended…"). This covers the reconnect path (ShardResume/ShardReady) and the initial ClientReady path.

**Keep all state recovery.** `notices.recover()` / `recoveryAttempt()` must still run on reconnect and startup: re-validate channel/roles, `suspendMissing` for actually-deleted roles/channels, reset the offline cutoff, unblock channels, update health, and clear failure episodes (`recovered()`). Only the `send(...)` of the recovery notice is removed. Adjust the health string so it no longer claims "Recovery notice delivered."

### Part B — targeted reply when an offline number is dropped

At the cutoff drop in `processMessage` (service.js ~line 55), instead of returning silently, reply to that specific message telling the poster it was not counted and what the next number is. Required content: it was not counted because it was posted while the bot was offline, and **the next number is N** (N = the current expected next number, from `dao.get(...)` then `next(current)` in presentation.js).

Example copy (finalize wording, keep it short and neutral): "Not counted — that was posted while the bot was offline. The next number is **N**."

Use `message.reply` (attributed to the dropped message) with `allowedMentions: { parse: [], repliedUser: false }` so it never pings. Then return true (still do not count it).

### Part C — consistency for the live outage warning

The existing `failure()` outage warning ("Counting unavailable. That number was not counted.") fires for a submission that arrives while the shard is still disconnected. For consistency it should also state the next number when it can be read safely (`dao.get`). Keep its existing episode dedup and nonce; do not turn it into a per-message spam source.

## Guardrails (must hold)

- **Only genuine number attempts.** `shouldHandle` only narrows inactive-channel messages; active channels accept arbitrary input for validation. Add an explicit pure-digit/no-attachment human-attempt check here; do not reply to non-numbers, bots, or webhooks.
- **Never tell someone their already-counted number was "not counted."** Before replying, confirm the message id is not an already-accepted event (dao). A delayed duplicate of an accepted number must not get a false "not counted" reply.
- **Dedup the reply per message.** A replayed/duplicate gateway event must not produce two replies (nonce or a replied-message-id guard, mirroring the existing notice nonce / failure-episode dedup).
- **Bound it to the recent offline window.** Do not reply to arbitrarily old messages; only numbers dropped because of the current/recent recovery cutoff. The gateway does not deliver ancient history, but keep a sane bound so a startup or late event cannot trigger a reply to old chat.
- **No broadcast.** Part B is a per-message reply only; it must not reintroduce a channel-wide announcement.
- Respect the existing serial/track lifecycle and `shouldAcceptWork()`. A reply is best-effort and must not throw into the counting path or block recovery.

## What must NOT change

- The cutoff anti-double-count semantics (gap numbers are still dropped, never counted).
- Turn order / alternation, duplicate detection in `dao.submit`, records/totals/history.
- The graceful-shutdown `down()` notice ("Restarting…") — fires once per drain, not the spam; retain it.
- Role/channel suspension on actual deletion, and the confirmation/permission model.

## Verification

- Unit: a number older than the cutoff gets exactly one reply containing the correct next number, is not counted, and does not ping; an already-accepted message id gets no "not counted" reply; a duplicate replay gets one reply; non-numbers/bots get none; reconnect and startup run state recovery (cutoff reset, unblock, suspension) with no broadcast send.
- Regression: full counting suite + lint/whitespace on changed files. Update `tests/counting_notices.spec.js` and `tests/counting_service.spec.js` expectations that currently assert the "Back online…" send.
- Live Discord: with a game active, disconnect/reconnect the shard (or restart), post a number during the gap, confirm it gets the "not counted, next is N" reply and no checkmark, then post N and confirm the checkmark; confirm no "Back online" broadcast appears in any counting channel across several reconnects.

No schema change, so independent PostgreSQL migration checks are not required. The live Discord reconnect check is a release gate.


## Implementation notes

- Recovery still validates state/roles/channels, suspends actually missing targets, maintains connection generations/cutoffs, unblocks intake, and clears failure episodes. It makes zero proactive channel sends, including for paused/suspended/new/limit games. Health says recovery completed rather than claiming a notice was delivered.
- A separate bounded feedback helper handles only recent human digit attempts with no attachments. Both the message age and recovery cutoff must be within 15 minutes; future or arbitrarily old timestamps are excluded. It reads the scoped message ledger (all processed outcomes/history) before fresh game state, then replies with mention suppression and a deterministic nonce.
- A two-phase prepare/deliver path keeps state/ledger reads inside the channel queue, while network delivery runs outside it. Replays claim once before awaits. The guard holds at most 5,000 unexpired IDs; saturation skips new optional replies rather than evicting live dedup claims. Failures are best effort and never change gameplay state.
- Across process restarts, Discord's stable nonce offers best-effort deduplication within its retention window; no new persistent reply ledger is introduced. The main count/event ledger, acceptance policy, turn order, and totals are unchanged.
- Live failure warnings retain their episode/nonce/reminder policy and append a fresh next number only when readable. Retired games and already-processed messages do not receive a false not-counted warning. Unknown counts are omitted, never guessed; the numeric limit gives a reset instruction.
- Verification includes silent initial/reconnect recovery, deletion/suspension and cutoff preservation, targeted next-number feedback, archived/accepted duplicates, concurrent replays, non-human/non-numeric exclusions, bounded age/capacity, failed reads/sends, draining, and slow-reply queue independence. Live Discord reconnect verification remains a release gate.
