# Replacement Phase 3 — Channel teams with multiple allowed roles

Status: implementation on `feature/counting-channel-teams`; review and live Discord checks pending.

## Product contract

A channel is a team. Its allowed roles are an eligibility filter, not separate teams or score buckets. One channel has one game, one pooled count, one record, one turn sequence, and one contributor board. Members holding **any one** allowed role may contribute; holding multiple matching roles never adds credit or bypasses take-turn rules. A role may be allowed in any number of channels in its guild.

Maximum: ten distinct allowed roles per game. One game per guild/channel remains enforced. Discord visibility/send permissions remain a separate layer configured manually. Owners/moderators do not bypass the counting role filter just because they can send messages.

This replaces the original Phase 3 flexible-input proposal. Text/images remain an optional post-production enhancement requiring an explicit decision to reactivate; production accepts pure numbers only. The user's request authorizes implementing this replacement now; pending live UX checks remain release gates.

## Admin experience

Keep setup simple:

1. Enter a dedicated counting channel and use `/counting setup role:@squad` for the initial allowed role. Preview and confirm the same defaults: take turns, wrong numbers keep progress.
2. In that channel, `/counting role-add role:@mod` previews allowing mod too. Confirm. Repeat for other roles, up to ten total.
3. `/counting role-remove role:@role` previews removing eligibility. Removing the last existing allowed role is refused; add its replacement first.
4. `/counting settings` lists allowed roles and actual rules; help, current, status, and the published guide explain **any one role** and the **shared channel team**. Channel standings identify teams by channel; individual contributions stay inside that channel.

An existing game needs no setup rerun or reset: its existing role becomes the first allowed role automatically. To allow mod in compound-interest after upgrade, run role-add there. Both role edits require Manage Server, fresh membership/channel access, and the existing private confirmation mechanism. Controls expire in two minutes and cannot replay a mutation. A changed role list invalidates an earlier preview under the same lock used for counts.

Duplicate adds and removing an unlisted role are harmless no-ops. Role edits preserve count, best, current run, previous contributor, and lifetime/archived history. They do not grant Discord roles or channel permissions. Rules remain under `/counting configure`; its former role/history options are replaced by the explicit eligibility commands. Stale old configure interactions get a migration instruction, never an accidental history reset.

## State and migration

- Preserve `counting_game` and its guild/channel unique constraint; add `counting_allowed_role(game_id, role_id)` with a composite primary key and foreign key.
- Backfill every old `counting_game.role_id`, including paused/suspended/retired games, then remove the old column and role-ownership unique index. Game/event/history/run IDs, counts, records, actor/message IDs, states, and configuration versions stay intact. Old archived histories stay archived; no reinterpretation of contribution totals.
- Initialization runs behind the application leader lock, after the prior leader has drained and before commands/login. The migration is a single transactional PostgreSQL script, repeatable after success and rolled back on failure. Do not run this schema change while an old leader still serves requests.
- Read game state and sorted role IDs in one statement. Serialize setup, eligibility edits, counts, and role deletion with the existing transaction lock. Enforce max ten and minimum one for manual removal inside that lock; concurrent admins cannot exceed the cap or remove both final roles.
- Do not downgrade to a pre-migration binary: it expects the removed role column and ownership model. Keep a database backup before production upgrade. No automatic reverse migration or progress reset is provided.

## Eligibility and lifecycle

Check current member roles against existing allowed roles at submission time. Fetch errors are not proof of role deletion. Remove an actually deleted role from every affected game in that guild, preserving other allowed roles and progress. A game remains active/paused as before while another allowed role exists; if its final role disappears, suspend it. Add a replacement and resume explicitly. Retired games remain retired.

Startup/recovery notices follow the same rule: a missing role among several must not suspend a playable channel. Saved last/next values, offline cutoffs, warning suppression, and channel-specific notification behavior remain unchanged. Never restore a deleted role from the legacy backfill on a later restart.

## Verification

- Upgrade an actual legacy-schema fixture with accepted history, count 42, record 52, paused state, and nontrivial run/history/version IDs; verify all values and IDs, one seeded role, working standings, and repeatable migration. Inject an error to prove migration rollback.
- Qualify through squad only, mod only, both roles, and neither. The shared counter advances once per accepted message, and a member with both roles cannot take consecutive turns when disabled.
- Reuse the same role in two games, preserve guild isolation, and keep one game per channel.
- Concurrently add enough roles to exceed ten; exactly ten remain. Duplicate adds do nothing. Concurrent final removals cannot leave zero roles. Counts, turns, records, and contributor totals do not change on role edits.
- Delete one of several roles, then the last role; verify partial deletion stays playable and final deletion suspends. Transient Discord errors must not prune roles. Add a replacement and explicitly resume.
- Preserve confirmation owner/visibility/expiry/duplicate/stale guards. Role changes invalidate pending previews; unprivileged members cannot edit eligibility.
- Check readable-channel discovery, any-role guidance, private standings, ten-role embed budget, and updated public guide. No role-based scoring or hidden-channel disclosure is introduced.
- Live Discord: migrate the existing compound-interest game, allow mod, alternate squad/mod members on one sequence, try a dual-role member twice, reuse squad in another channel, and verify all boards and saved progress after restart.

Live Discord and independent PostgreSQL migration checks are required before treating the phase as release-qualified.

Validation record: 87 targeted counting tests and 465 full regression tests passed; changed-file lint/whitespace checks passed. Six opt-in PostgreSQL scenarios (including legacy migration and concurrent role-cap/final-removal checks) remain pending because the isolated PG16 container start timed out. Cleanup was attempted but timed out too; no database pass is claimed. Live Discord role eligibility/migration checks remain pending.
