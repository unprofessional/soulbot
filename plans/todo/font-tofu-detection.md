# Missing-Glyph and Tofu Detection

Status: todo.

## Practical outcome

Soulbot can identify characters that none of its eligible canvas fonts can render, aggregate those misses, and preserve enough information to decide which fonts should be added next. This catches likely tofu before an image is published without attempting unreliable visual recognition on the finished PNG.

## Level of effort

Small to medium — approximately 1–2 engineer-days, including font coverage indexing, pre-render scanning, privacy-safe persistence, integration across canvas surfaces, automated coverage, and production validation. Emoji grapheme sequences and system-versus-bundled fallback behavior are the main sources of uncertainty.

## Proposed behavior

- Build a Unicode coverage index from the exact bundled font files Soulbot registers for canvas rendering.
- Scan visible strings before rendering member cards, X posts, video canvases, quote posts, polls, and thread snapshots.
- Check ordinary text against the shared text-font chain and check emoji through a separate emoji-eligible path. Do not add emoji fonts to the ordinary text chain, where they can reintroduce excessive spacing for Japanese characters and numbers.
- Iterate Unicode code points safely and account for grapheme components. Ignore non-rendering controls, variation selectors, and joiners where appropriate without hiding a genuinely missing combining mark or emoji component.
- Record a likely miss only when no eligible registered font contains the code point. Do not try to recognize tofu from output pixels; legitimate boxed characters make that approach unreliable.
- Never block or fail a render because coverage telemetry failed. Batch or asynchronously upsert observations after the scan.

## Stored analysis data

Aggregate observations rather than storing complete user text:

- Unicode code point and printable character where safe.
- Canvas surface, such as `member_card`, `x_post`, or `thread_snapshot`.
- First-seen and last-seen timestamps.
- Total occurrence count.
- Font-chain or application version used for the scan.
- Optional Unicode name/category resolved outside the rendering hot path.

Do not retain surrounding message content, guild IDs, channel IDs, or user IDs solely for this feature.

## Analysis workflow

- Provide an index-backed query or small report that ranks missing code points by frequency and affected surface.
- After adding a font, verify its coverage index resolves the recorded character and mark future occurrences as covered rather than continuing to count them as misses.
- Keep historical aggregate rows so font additions can be justified from production frequency instead of one-off screenshots.

## Verification

- Prove `U+AADF` is reported when Noto Sans Tai Viet is absent and is covered after that font is registered.
- Verify Japanese text and `1234567890` produce no missing-glyph observations and retain the existing compact X-render spacing.
- Cover emoji presentation selectors, zero-width joiner sequences, combining marks, supplementary-plane characters, and unsupported code points.
- Confirm duplicate occurrences aggregate atomically under concurrent renders.
- Confirm database or scanner failure cannot prevent a member card or X canvas from rendering.
- Measure scanner overhead against typical and long X posts before production rollout.
