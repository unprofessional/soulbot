# Counting Phase 2.5 — Guided setup and everyday use

Status: implementation of 2.5A–D on `feature/counting-guided-ux`; targeted automated verification passes; PR review pending. Live Discord/mobile usability gate remains pending.

Priority: next counting work. Completing the Phase 2.5 usability gate is a prerequisite for Phases 3–5; only an explicit user reprioritization can override it, with the roadmap updated to match. Phases 1–2 are already merged into master through PRs #105–#108. Preserve their counting rules and data. This phase includes delivery of the existing counting-channel lifecycle-notice follow-up; its detailed behavior remains in the main counting plan.

## Outcome

A manager who has never read the manual can set up two competing teams, understand the rules they chose, and tell members how to start. A member entering a counting channel can discover who may count, the next number, whether it is their turn, and what to do after a rejection or outage. Every response answers the relevant question and offers one clear next action.

## Analysis of the current experience

This is a source-based UX audit of the merged command definitions, interaction router, counting service, views, and README. It is not a live Discord usability test. Findings below describe implemented behavior; suggested flows are new work.

| Current evidence | First-time user problem | Required improvement |
| --- | --- | --- |
| Subcommand descriptions are generated as `current a counting game`, `settings a counting game`, etc. | The picker does not explain what selecting a command accomplishes. | Give each command an outcome-based description. |
| Help is one paragraph containing setup, member rules, administration, standings, and future features. It requires the service and a normal text-channel context to be available. | Users must already know which part applies to them; help can fail when most needed. | A short, context-aware starting point with separate member and manager guidance; generic help works without a configured game or healthy database. |
| `current`, `status`, and `settings` share the same response branch. | Three commands appear interchangeable and bury the next number in operational detail. | Separate next-turn, rules, and manager diagnosis views. |
| Help says setup will “assign a team role”; setup actually associates an existing role with a game. | Managers may believe the bot grants roles or segregates channel access. | Say explicitly: members must already hold the role, and managers control channel access. |
| Setup requires a channel and role and offers mistake/consecutive-turn choices before the first game. | Managers face context selection and rule decisions before learning how to play. | In 2.5B, reduce setup to the role alone in the invoking channel; teach defaults and defer rule changes to configure. |
| Setup immediately creates an active game and returns `Counting setup completed`. | Managers cannot see default behavior or the effect on ordinary messages before activation; no next step is supplied. | Preview channel, team, rules, and cleanup behavior before activation; return a ready-to-use handoff. |
| Optional channel defaults to the invoking channel for most commands; server standings have no channel target. | Users do not know which channel an action affects or whether a channel is needed. | Always name the target; distinguish channel actions from server-wide standings. |
| `consecutive`, `reject`, `reset`, `scope:run`, and `history:reset` appear without clear consequences. | A Boolean or short choice label hides game behavior and data consequences. | Explain alternation, mistakes, run totals, and retained/reset team history in plain language with examples. |
| All management successes use the same generic completion message. | Users cannot tell what changed, what was preserved, or how to continue. | Action-specific before/after summary and next command. |
| Reset, retirement, and team-history reset execute without a preview. | Managers can unintentionally restart a game or erase the current team's displayed totals. | Confirm consequential actions with their exact effect and target. |
| Rejection messages identify a rule but often omit the affected team, whether progress changed, or a usable recovery path. Required-permission loss can consume attempts silently. | Members cannot distinguish their own mistake from a paused game or bot problem. | Concise reason + saved progress/next number + appropriate member/manager next action; bounded operational notices for failures. |
| Status combines stored state with `Permissions: ready` and technical failures can surface directly. | A paused game can appear “ready”; members see database language instead of an explanation. | Show one effective availability state; keep technical details in manager diagnostics/logs. |
| Rankings use “lifetime (current history)”, `run`, raw state values, and page numbers with no navigation. Deleted roles can render unresolved mentions. | Users cannot interpret totals, ties, or how to see the next page. | Human labels, units, relevant empty-state guidance, valid navigation, and deleted-role fallback. |
| Counting-channel startup/shutdown notices remain only planned. | A member can continue posting through an outage without knowing which entries counted. | Implement the existing lifecycle notice contract; recovery explicitly shows saved last/next numbers. |

## Experience contract

- Lead with the answer or outcome. Use short fields or small embeds where they aid scanning; do not rely on color or emoji alone.
- Distinguish **play**, **rules**, **team standings**, **contributors**, and **management**. Explain only options relevant to the current action.
- Name the channel and team whenever showing game-specific information. Suppress mentions by default.
- Show actual effective settings, not just defaults. In the simplified 2.5B setup, rules always start with the fixed documented defaults; on configure, omitted values keep existing settings.
- Use “take turns” for alternation, “wrong numbers keep progress / restart at 1” for mistake rules, “since the last restart at 1” for a run, and “all accepted contributions for this team history” for lifetime totals. Ordinary bot restarts do not start a new run.
- Retain existing slash command names and option identifiers except the explicitly approved 2.5B setup simplification: remove setup’s `channel`, `mistakes`, and `consecutive` options, keeping only required `role`. Other commands keep their options. Improve descriptions and choice labels; do not add synonyms for every existing action.
- Offer working slash-command examples with actual channel references. Buttons may shorten navigation, but every read flow retains a slash-command fallback.
- Never require a manual, repository access, or bot logs for normal member use. Generic help and safe operational explanations do not depend on successful game queries.
- Do not advertise text/images, goals, pins, attacks, or restoration before their phases ship. Explain current limitations only where they affect the user's next action.

## Command and option map

| Surface | Purpose and response | Next step |
| --- | --- | --- |
| `/counting help [channel] [page]` | Starting point: “Count together in order. Teams compete in separate channels.” Show the concrete channel/team/eligibility discovery list specified below, explain how to play, and show setup steps only to managers. An optional channel adds contextual guidance without removing discovery. Managers also get the concrete first-run preparation checklist below. | Play in an accessible channel; managers can set up a team. |
| `/counting current [channel]` | Channel/team, saved last number, next number, and viewer turn eligibility. No full permission dump. | “Post 43” or “Another teammate must post 43.” Paused/unavailable states explain why posting will not count. |
| `/counting settings [channel]` | Readable rules: team eligibility, take-turn policy, wrong-number behavior, accepted input, cleanup behavior. | Members: current number. Managers: example configure command with this channel. |
| `/counting status [channel]` | Effective availability and progress. Members receive a short explanation; managers receive named missing permissions/target problems and specific repair steps. | Resume, repair permissions, choose a replacement role, or retry status as applicable. |
| `/counting setup role` (in the target channel) | The invoking channel is the target; role is the only option. Preview channel/team, fixed defaults, requirements, and activation effects; confirm before creating the game. | Acknowledge setup, show how two members begin, and offer a channel guide. |
| `/counting configure [channel]` | No supplied changes: show editable settings with examples, not a meaningless success. Supplied changes: preview affected settings; confirm a team reassignment. | Show effective rules and current number after the change. |
| `/counting leaderboard [page]` | “Team standings — ranked by current count”; show channel, team, current, best, and readable availability. Explain tied places briefly. | Open an accessible game or request a valid next page. |
| `/counting top [channel] [scope] [page]` | “Top contributors — accepted numbers”; explain selected period and retain/reset semantics in a short footer. | Switch period or request a valid next page. |
| `/counting pause/resume/reset/retire [channel]` | Explain and confirm consequences as specified below; report actual resulting state and preserved data. | A concrete continue/recover action. |

Option descriptions must state the default and effect wherever space permits; longer explanations belong in the preview/settings response. The `history` choice is relevant only when changing the team role; reject or explain irrelevant history choices rather than implying they did something.

### Member discovery — “Where can I play?”

This is a required Phase 2.5A surface, not a later navigation enhancement. `/counting help` starts with **Your counting channels**, followed by the short how-to-play explanation and role-appropriate next steps. It works when invoked outside a counting channel. Preserve the existing optional `channel` argument for contextual guidance and add an optional `page` argument for discovery pagination; Phase 2.5C may add buttons to this same view.

- Refresh the viewer's membership, channel overwrites, and role permissions. List only same-guild, non-retired counting channels where the viewer has both View Channel and Read Message History. Apply this filter before pagination/counts; do not reveal hidden channel names, teams, counts, or even the number of hidden games.
- Each entry shows a channel jump reference, team role (or a readable deleted-role label), and a plain-language participation state. Include an exact `/counting current channel:#channel` example as its next action. Show five entries per page, in deterministic channel-ID order, with valid previous/next command examples; do not make users guess a channel identifier.
- Distinguish role eligibility from turn/state restrictions: **Can count now**, **Wait for another teammate**, **Need Red Team role — ask a manager**, **Cannot send messages here — ask a manager**, **Paused**, or **Counting unavailable — ask a manager**. Derive these from the role, member send permissions, game state, last accepted author, take-turn rule, supported count limit, and known bot availability. Do not show “Can count now” on role membership alone. Game unavailability takes precedence; a secondary role/access explanation may still help the member recover.
- List all readable teams, including those the viewer cannot yet join. Members holding multiple team roles see every eligible game; do not arbitrarily select one “home team.” Never grant membership or permissions from discovery.
- For an active game with known saved state, the entry may show the next number, but always direct the user to the current view before playing when the result might be stale. Paused/unavailable entries must not invite posting a number.
- If readable games exist but none are currently playable, explain each visible blocker and offer the appropriate next step. If no readable games exist, say “No counting channels are available to you. Ask a server manager”; managers instead get a setup example. Do not claim no games exist anywhere in the server.
- If discovery data cannot be loaded, keep generic help available and say the channel list is temporarily unavailable. Never confuse query failure with an empty list, infer eligibility from stale data, or invent saved/next numbers. A member can retry help; a manager can inspect status.

Example discovery entry:

> **<#red-count> · Red Team** — Wait for another teammate.\
> You counted last. Check the next number with `/counting current channel:#red-count`.

Channel references above are illustrative; render real accessible channel mentions/jump references in Discord. Role requirements must name the actual team, with mentions suppressed.

### Manager first run — “How do I create the competition?”

This checklist is required in the manager section of `/counting help` starting in **2.5A**, including when there are no games or the counting store is unavailable. **2.5B** reuses it before the setup preview and in the setup-success handoff. It must be actual in-Discord guidance, not a link to the README or a single “configure permissions manually” sentence. Keep it as a short numbered sequence with concrete examples; distinguish preparation from activating Soulbot.

1. **Create a team role.** In Discord's server role settings, create an ordinary role such as **Red Team**. Repeat for **Blue Team**. Use an existing suitable role instead if the team already exists. If you cannot create roles/channels, ask a server administrator to help; permission to run Soulbot's manager commands does not itself let the bot or manager create everything.
2. **Give members their team role.** Assign Red Team to the members who should count for Red, and Blue Team to Blue members. With the default take-turn rule, each team needs at least two human members to keep counting. Soulbot's `role` option selects who may contribute; it does not assign that role to anyone. A member with both roles can contribute to both teams under current rules.
3. **Create a normal text channel for each team.** For example, **#red-count** and **#blue-count**. Use dedicated channels because active counting removes invalid/non-counting posts when Soulbot has cleanup permission. One non-retired counting game per team role is supported; do not reuse Red Team for a second active game.
4. **Set the channel's team access in Discord.** Give Red Team **View Channel**, **Read Message History**, and **Send Messages** in #red-count; repeat for Blue Team in #blue-count. If the channels should be team-only, restrict general access and review other role/member overrides too. Test with an ordinary team member: owners/administrators are not a useful check for team-only access. Channel visibility and Soulbot's contribution eligibility are separate—seeing a channel does not grant the team role.
5. **Give Soulbot access to each counting channel.** It needs **View Channel**, **Read Message History**, and **Send Messages**. **Add Reactions** enables acceptance check marks; **Manage Messages** enables invalid-post cleanup. Explain these as required versus optional capabilities, not an instruction to grant every server permission.
6. **Activate each game from its channel.** Open **#red-count**, run `/counting setup role:@RedTeam`, select the real role in Discord’s role picker, review the defaults, then confirm **Start counting**. Open **#blue-count** and repeat with Blue Team. The channel is always where the command was invoked; setup has no channel or rule options. Make clear that example names are placeholders, not literal role identifiers. Explain immediately: teammates take turns; wrong numbers keep progress. Change rules later with `/counting configure`. Setup associates the role and channel—it does not create them or change their permissions.
7. **Check and hand off.** Run `/counting status channel:#red-count` to check Soulbot's readiness; follow any named permission/role repair. A ready status checks bot/game prerequisites, not proof that every intended member has the right access. Use **Post channel guide** when available, then ask two ordinary Red members to post **1** and **2**. Repeat in Blue and check `/counting leaderboard`. If a member cannot see/send, fix channel access; if they can post but lack the team role, assign it; if they counted last, ask another teammate to take the next turn.

**Presentation and recovery requirements**

- A manager arriving with no configured games sees **Set up your first team** and this preparation checklist before the setup command example. An existing competition shows a short **Add another team** entry that opens the same steps. Contextual help can name the selected readable channel/team, but it must not assume preparation is complete.
- When a role/channel already exists, let managers skip the corresponding creation step. Do not auto-create resources, grant roles, or mutate overwrites. Normal setup validation remains authoritative; the checklist is guidance, not a new permission-management engine.
- Do not mark role assignment, team isolation, or member access as verified merely because setup succeeded. State what the bot checked versus what needs an ordinary-member test. Do not expose inaccessible existing channels as suggestions.
- Keep the same next-step terminology in help, setup preview, and success. Before setup: “Create/select the role and channel, assign members, set access, then open that channel and run /counting setup role:….” After setup: “Check status, post the guide, then have two teammates begin.” If guide controls have not shipped yet, supply the same short shareable rules and do not show a dead button.
- Manager help remains available when a step fails. Missing role/channel, missing bot access, duplicate assignment, or an already-configured game should link back to the relevant step or to configure/resume, with the target named where it is safe to show.

### Simplified setup contract — Phase 2.5B

Product direction: **one command, one option, from within the channel**. The canonical setup is `/counting setup role:@RedTeam`. This deliberately supersedes the earlier preserve-all-options compatibility rule for setup alone.

- Register exactly one required option, `role`. Remove `channel`, `mistakes`, and `consecutive` from setup; do not add an advanced setup variant or another upfront rule-selection step.
- Bind the target to the invoking normal guild text channel. Preview its actual channel/team and bind the confirmation session to that guild/channel/user. An unsupported context explains “Open the text channel you want to use, then run /counting setup role:…”; do not silently choose another channel or add a channel picker.
- A new game always starts at 1, requires teammates to take turns, and preserves progress on wrong numbers. The preview explains these defaults and confirms activation; it does not ask the manager to choose them. Setup cannot reset/reconfigure an existing game.
- Teach the active rules in the success handoff, settings, posted channel guide, and contextual rejection/current responses. Show a concrete `/counting configure` path for managers who later want different rules; never imply a default still applies after it changes.
- Keep the manager’s Discord-preparation checklist and reset/retire/team-change confirmations. Role/channel creation, assignment, and permissions remain manual. Bot-assisted preparation is a separate possible future proposal, outside this directive.
- Deploy the new registration, handler, preview/coaching, examples, and command-shape tests together. Phase 2.5A must describe the currently registered setup accurately until 2.5B ships; it must not tell users a role-only invocation works while the old channel requirement is still deployed. Once 2.5B ships, every active help/example uses the role-only form and tells the manager to enter the target channel first.
- Removed options are an intentional command-surface change, not silently ignored legacy input. Refresh registration; handle any stale interaction carrying an old setup option with a short retry instruction using the new form. Preserve existing games, rules, totals, and all `/counting configure` options.

### Management consequences

- **Pause:** stop accepting counts; preserve current progress and totals. Resume continues from the saved next number.
- **Resume:** revalidate prerequisites and report the next number and turn rule. If blocked, show the exact repair instead of success.
- **Reset:** preview the current value and return to 1; preserve the best count and lifetime contributor totals; clear current-run totals/last-turn restriction. Require confirmation.
- **Retire:** preview removal from active competition and team standings, preservation of history, normal channel chat behavior, and how to reactivate later. Require confirmation. Do not describe it as deleting the channel or all data.
- **Change team:** require an explicit keep/start-fresh choice; confirm both alternatives' concrete effects on count, record, and contributor totals. “Start fresh” archives prior data rather than physically deleting it. Explain that retaining history credits previous activity to the replacement team.
- **Setup in an existing/retired game channel:** show its actual state and configure/resume options. Do not send the manager through a dead-end “already exists” error.

### Example responses

Member current view:

> **#red-count · Red Team**\
> Last: **42** · Next: **43**\
> You counted last. Another teammate must post **43**.\
> Post numbers only. See `/counting settings` for the rules.

Setup preview:

> **Start counting in #red-count for Red Team?**\
> Start at **1**. Teammates take turns. Wrong numbers keep progress.\
> Change rules later with `/counting configure`.\
> Members need Red Team already; this does not assign roles or change channel access.\
> Only counting posts belong here while active. Invalid posts are removed when Soulbot has permission.\
> **Start counting** · **Cancel**

Setup success:

> **Red Team is ready in #red-count.**\
> One teammate posts **1**, a different teammate posts **2**.\
> Rules: take turns; wrong numbers keep progress. Change them later with `/counting configure`.\
> Members need the Red Team role and permission to send messages here.\
> Next: check channel access, then **Post channel guide** or open the channel.

Mistake with preserved progress:

> Expected **43**. Your number was not counted. Progress stays at **42**. Another eligible teammate can post **43**.

Missing-role rejection:

> You need the **Red Team** role to count here. Ask a server manager to give you that role.

Use the actual team role label; if the role was deleted, explain that counting is unavailable instead of asking the member to obtain a nonexistent role. Apply suppressed mentions to role labels.

The final turn wording must be derived from current rules and last accepted author; do not claim every member can submit when one must wait. For reset mistakes, say `Count restarted. Next: 1.` and explain preserved totals in settings, not in every rejection.

Recovery notice (retain the existing minimal-copy requirement):

> Back online. Offline numbers may be missed. Last: **42**. Next: **43**.

## Modular delivery sequence

### 2.5A — Clear language and distinct read views

**Scope:** presentation helpers, command descriptions, context-aware help with the concrete channel/team/eligibility discovery list, separate current/settings/status responses, plain-language options, action-specific success/error copy, empty states, deleted-role labels, and textual pagination instructions. Include count/turn eligibility reads without mutating acceptance.

Generic help works without a configured game, from supported guild contexts, and during counting-store unavailability. It must not require fetching a channel the user cannot access. An unconfigured channel gives a manager the first-run checklist and a concrete setup example; members get accessible-channel discovery or “Ask a server manager to set up a counting channel.” Hidden games never appear in discovery or diagnostics.

**Exit:** every existing slash command remains functional; each response has its own purpose, actual target, and next step. No placeholder buttons or references to later subphases. Count acceptance, permissions, and rankings are unchanged.

### 2.5B — Guided setup and safe management

**Scope:** ship the role-only, invoking-channel setup contract and defaults coaching together; integrate the manager preparation checklist into its handoff, setup preview/confirm/cancel, team-reassignment preview, reset/retire confirmation, and an explicit manager action to post a short public channel guide after setup. The guide explains eligibility, take turns, mistakes, accepted input, and `/counting current`; it does not print a next number that will become stale. Posting does not auto-pin or change permissions. A manager can regenerate it from help/settings after changing rules; label it with its posting time and tell readers that `/counting settings` shows current rules.

A guide publication failure must not undo successful setup: report “Game created; guide could not be posted” with a retry path. All previews stay private; publishing a guide requires an explicit manager click. Buttons use the interaction infrastructure described below. Setup remains usable through the slash command and its confirmation, without a multistep wizard or new gameplay state.

**Exit:** setup exposes exactly one required role option and targets only its invoking channel. A new manager can create two teams and hand off play without choosing rules or reading documentation; they can explain the defaults and find configure afterward. Cancel/expired previews make no changes; double clicks cannot duplicate an action. Confirmations recheck current permissions, target state, and the data shown in the preview before applying it. Existing commands continue to work when optional guide publication fails.

### 2.5C — Navigation and useful rankings

**Scope:** lightweight read-only navigation between current/rules/teams/contributors, period selection, and Previous/Next ranking controls. Reuse the same renderers as slash commands. Hide/disable invalid pages; typed out-of-range requests explain the range and offer the last valid page rather than `Page 99/2`. Keep live-result disclosure and shared-rank semantics.

**Exit:** navigation works for ordinary members; managers do not need to teach command syntax to browse. Every click refreshes permissions before querying/displaying results. Expired controls explain how to reopen the view. Fallback slash commands remain usable without components. No additional ranking data or changes to scoring.

### 2.5D — Operational clarity and first-time-user gate

**Scope:** implement the already-planned Phase 1 counting-channel down/restart/up notices, using that specification rather than inventing another outage policy. Add effective-state display, actionable manager repair messages, and a bounded per-channel operational-notice policy for failures that currently swallow submissions silently. Store/database failures must not be called member mistakes or successful counting; when channel feedback is possible, say acceptance could not be confirmed and point to the current-count command. Attempt a channel-visible notice immediately on the first observed failure when Discord sending is possible; do not wait for recovery to explain the problem. For a known pre-acceptance block say “Counting unavailable. That number was not counted”; for a commit/acknowledgement ambiguity say “Could not confirm your number. Check /counting current before trying again.” An abrupt disconnect cannot send that notice until connectivity returns.

Deduplicate by channel and outage episode. After the first successful warning, suppress identical per-message warnings; allow at most one reminder per channel per 60 seconds while failures continue. Clear suppression after verified recovery so the next distinct outage warns immediately. A failed warning send does not count as delivered: retry with bounded backoff, retain manager-visible failure status, and avoid an error reply for every queued message.

If the saved count cannot be read, say it is unavailable; never invent last/next values. Only show “ready to count” when the game is active and required prerequisites are healthy. A known paused/suspended/retired state takes precedence over a green permission check. Keep optional reaction/cleanup/ranking problems distinct from a counting outage.

**Exit:** a restart or permission problem gives members an explanation and managers a recovery path. Test the whole journey with a manager and members who have not read the manual. Completion of the lifecycle adapter also closes the existing Phase 1 follow-up checkbox; it is one implementation, not two.

## Implementation boundaries and interaction safety

- Extract counting presentation/context helpers so slash responses, buttons, guides, and notices use the same terminology and effective rules. Keep the write DAO and accepted-entry ledger authoritative.
- Extend the central interaction router to dispatch counting-owned components explicitly; today it handles chat/context commands and warns for other interaction types. Route other features unchanged. Apply lifecycle/drain handling to component work too.
- Use short-lived, user/guild/channel-bound confirmation sessions with opaque identifiers and a defined timeout (two minutes). Restart loses an unconfirmed preview safely. Session expiry/cancel returns a fresh slash-command path. Do not trust action/role/permission claims encoded in client-controlled component values.
- Re-fetch membership/visibility and recheck management authorization on every action. Under the existing transaction lock, atomically compare the previewed game/history/run/configuration and relevant count/last-entry state before executing consequential actions. The current configuration version alone is insufficient because accepted counts do not increment it. If data changed, show an updated preview and require confirmation again.
- Successful confirmation consumes its session; duplicate events cannot repeat resets/retirement/setup. Revalidate the final state inside the transaction, not only before opening the preview.
- Keep read responses private and suppress mentions. Public guides/notices are limited to their game channel and contain no private-channel or member diagnostic details.
- Map expected errors to user-facing reasons and next steps. Unexpected errors get a short reference for managers; detailed database/API messages stay in logs.
- Avoid migrations to gameplay data or changes to acceptance, scores, eligibility, history, or offline policy. Confirmation safeguards may extend management APIs; they must use the existing transaction boundary and preserve audit events.
- Existing games gain the improved UI immediately after command registration refresh. No setup rerun, count reset, role reconfiguration, or guide publication is required. Optional UI sessions/guides failing must not disable core counting.

## Verification and acceptance

Automate behavior where regression would matter: context-to-view/turn mapping, permission-gated discovery and actions, setup/management confirmation expiry/cancellation/duplicates, stale-preview handling during counts/resets/reassignment, effective availability, page bounds, generic-help fallback, and integration routing of both slash and component actions. Do not rely on screenshots or exact-copy assertions alone. Add a command-shape check that setup has exactly the required role option, plus invoking-channel binding, unsupported-context, default creation, stale-option retry, and unchanged configure coverage. Preserve the existing counting/PostgreSQL suite.

Discord usability gate:

1. Give a manager only the goal “make Red and Blue teams compete,” with no existing roles/channels. From help alone they can create or select two roles/channels, assign at least two human teammates each, set team and bot access, understand defaults, activate both, and test 1/2 as ordinary members without the README. Repeat with existing resources and insufficient creation permissions; guidance must explain skipping completed preparation and asking an administrator for help. Verify the manager enters each target channel and selects only its role, can explain take-turn/preserve-progress defaults from coaching, and can find configure to change rules later. Verify setup does not imply that membership, team isolation, or member access were automatically configured or checked.
2. Starting in a non-counting channel, a member uses help to find their readable counting channels, team role requirements, eligibility/turn state, and channel jump references. Test no visible games, several eligible roles, a readable but ineligible team, denied sending, pagination, and store failure without leaking hidden games. The member then sees the channel guide, finds the saved/next number, and understands waiting for another teammate. They can recover from a wrong number, missing role, or paused game without guessing.
3. A manager can explain what reset, retire, and team-history choices preserve before confirming; cancellation and expiry change nothing. Counting during a preview cannot cause an outdated confirmation to erase unexpected progress.
4. Members can distinguish team standings from personal contributions, explain the period, and browse a second page. A hidden channel contributes no entry, rank, page total, or navigation target.
5. The first observable failure attempts an immediate warning, repeated attempts are deduplicated/rate-limited, a failed send is retried rather than marked delivered, and a distinct outage warns again after recovery. A restart produces warnings/recovery notices with accurate saved numbers. Missing permissions or a store failure never appear as a successful count or misleading “ready” status.
6. A newcomer can use all of the above on Discord's narrow/mobile layout; messages remain short enough to scan and controls have explicit text labels. Record misunderstandings and resolve blocking ones before marking the phase complete.

## Non-goals

New gameplay, more parsing options, automated role assignment/permission changes, a web dashboard, leaderboards beyond Phase 2, automatic pins, and future rewards/effects. A continuously updated channel topic or pinned live count/turn display is deliberately deferred to a separate post-2.5 ambient-status proposal: ownership of channel metadata, refresh cadence, permissions, and rate limits need their own design. For this phase, the channel guide is static, ✅ remains the ambient acceptance signal, and `/counting current` provides live state. Do not resume Phases 3–5 until this interim usability gate is complete or explicitly reprioritized.


## Implementation handoff

- Shared permission/context and presentation helpers drive help, turn-aware current, rules, status, guide, and rejection copy. Discovery uses refreshed permissions and filters before pagination; generic help survives a store failure.
- Setup registers exactly one required role option and targets its invoking channel, with fixed defaults and private confirmation. Existing configure options remain. Opaque two-minute sessions bind controls to user/guild/origin channel; confirmations carry an authoritative target and snapshot compared under the counting transaction lock. Cancel, expiry, duplicate controls, and stale previews are covered.
- Read-only buttons connect discovery/current/rules/teams/contributors and periods/pages. Invalid typed pages offer a valid last page. Public guide publication is explicit and independent of game creation; guide failure preserves gameplay.
- The lifecycle adapter coalesces connection generations, gates/reopens per channel with a new offline cutoff, serializes saved-state notices with counting/management, retries with limits, exposes delivery failures in status, and keeps unrelated shards open. General announcements skip counting channels. Counting work and shutdown notices drain before general announcements/client/database cleanup.
- Notice delivery is best effort; Discord timeouts can be ambiguous despite nonce deduplication. No advance crash notice is possible, and startup cannot notify undiscoverable channels while configuration is inaccessible. These limits do not change the saved-count/offline policy.
- Tests cover command shape, discovery/privacy/turn state, component routing, confirmation authorization/expiry/duplicates/stale snapshots, guide failure, page/period controls, permission diagnosis, outage warning/retry limits, distinct shard recovery, and missing/unavailable targets. The opt-in PostgreSQL suite now includes confirmation races. See `features/counting/README.md` for deployment and the live usability checklist.
- Do not mark the phase or lifecycle-follow-up release gate complete until live Discord/mobile usability checks pass. Future gameplay phases remain gated as specified above.

Validation record: 84 targeted counting/announcement tests passed; changed-file lint and whitespace checks passed. Full regression checks also run in the commit hook. Four disposable-PostgreSQL scenarios remain opt-in/pending because the local container start timed out; no database pass is claimed. Live Discord/mobile usability testing is pending.
