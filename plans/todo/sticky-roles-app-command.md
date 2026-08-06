# Sticky Roles App Command

Status: todo.

## Practical outcome

Authorized moderators can choose roles that Soulbot remembers when a member leaves and restores when that member rejoins. This preserves selected community roles without making every role sticky or requiring manual reassignment.

## Proposed behavior

- Add a guild-only `/sticky-role` app command with `add`, `remove`, and `list` subcommands.
- Gate command visibility with Discord's `ManageRoles` permission and repeat the permission check at execution time.
- Allow only roles that Soulbot can manage: never `@everyone`, bot/integration-managed roles, or roles at or above Soulbot's highest role.
- Store the configured sticky role IDs per guild.
- When a member leaves, store only the configured sticky roles they actually held.
- When the member rejoins, restore only roles that still exist, remain configured, and are still manageable by Soulbot.
- Treat missing/deleted roles and departed bots safely, and make repeated leave/join events idempotent.

## Verification

- Permission tests for authorized moderators and ordinary members.
- Role-hierarchy, managed-role, deleted-role, and cross-guild validation tests.
- Leave/rejoin smoke test proving selected roles return while unrelated roles do not.
- Confirm failures are logged without blocking the member join flow.
