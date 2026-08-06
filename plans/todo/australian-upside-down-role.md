# Australian Upside-Down Role

Status: todo.

## Practical outcome

Messages from a member carrying a role named `australian` are replaced with an upside-down version under that member's own display name and avatar.

## Level of effort

Small — approximately 1–1.5 engineer-days, including the Unicode transformation, integration with the shared webhook replacement flow, processor-conflict safeguards, automated coverage, and a Discord smoke test. Preserving attachments and reply context through every existing role-transformation combination is the main source of variance.

## Proposed behavior

- Detect the `australian` role case-insensitively on ordinary guild messages.
- Transform supported characters to their upside-down Unicode equivalents and reverse their visual order. Leave unsupported characters readable rather than dropping them.
- Reuse the existing short-lived webhook replacement path so the transformed message retains the member's server identity.
- Preserve attachments, safe mentions, thread placement, and simulated reply context where the shared webhook helper supports them.
- Ignore bots, webhooks, empty messages, and messages that cannot safely be replaced.
- Integrate this with the existing owner-proxy, Goldy, and speak-English transformations so one source message is consumed at most once and cannot trigger a webhook loop.
- Keep the role itself administrator-managed; Soulbot should respond to the role but should not grant it implicitly.

## Verification

- Character-map and reversal tests covering letters, numbers, punctuation, emoji, and unsupported Unicode.
- Role matching, bot/webhook avoidance, attachment, reply, thread, and allowed-mention tests.
- Interaction tests proving multiple role-based processors cannot delete or proxy the same message twice.
- Real Discord smoke test for display identity, mobile/desktop readability, and webhook cleanup.
