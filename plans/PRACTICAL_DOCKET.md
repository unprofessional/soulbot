# Practical Docket

This is the running record of what completed work actually gave us.

It is intentionally not a conventional PR changelog. Entries should answer practical questions:

- What can we do now that we could not do before?
- What became faster, safer, clearer, or easier to operate?
- What did real verification prove?
- What remains unproven or still requires follow-up?

Implementation details belong in the PR. This docket records outcomes.

## 2026-08-05 — Twitter/X video Phase 0 performance baseline

Branch: `perf/twitter-video-baseline-instrumentation`  
Commit: `70e0dfd` — `Instrument Twitter video performance baseline`

### What we actually gained

- We can now see where each video-rendering job spends its time instead of reasoning from one total-duration log line. Downloading, probing, canvas creation, hashing, normalization, encoding, validation, upload, and cleanup are measured separately under one run identifier.
- We now have a repeatable benchmark that exercises the real production renderer with the same local media corpus every time. Future optimization phases can be compared against a stable baseline without CDN download variance distorting the result.
- Benchmark results are saved as raw and summarized JSON, including median, p95, minimum, maximum, success count, and failure count. Performance decisions no longer need to rely on a single run or an informal stopwatch.
- The corpus now exercises ordinary landscape video, portrait video, silent video, variable-frame-rate input, audio offsets, timestamp edge cases, and a near-60-second input. That gives later changes a much better chance of exposing synchronization or compatibility regressions before production.
- A local rehearsal completed all seven corpus cases successfully. It showed that normalization and probe launches are measurable fixed overhead, while composite encoding remains the dominant cost for longer videos. That confirms the ordering of the proposed optimization work.
- Production telemetry uses the existing render path and preserves the existing Discord progress messages. No encoder, quality, layout, audio, watchdog, upload-limit, deduplication, cleanup, or fallback behavior was intentionally changed.

### What this did not prove yet

- It did not make video rendering faster by itself. Phase 0 gives us the measurement system needed to prove whether later phases are genuinely faster.
- The complete five-run-per-case `shinralabs` baseline was interrupted and must be rerun after review and merge before Phase 1 starts.
- Real Discord smoke coverage for every corpus category still needs to be completed as part of the Phase 0 stop gate.

## Docket entry template

```markdown
## YYYY-MM-DD — Outcome-oriented title

Branch: `branch-name`  
Commit: `short-sha` — `commit subject`

### What we actually gained

- Concrete new capability, improvement, or operational result.
- Evidence from tests, benchmarks, production, or user-visible behavior.

### What this did not prove yet

- Remaining uncertainty, deferred verification, or explicitly excluded scope.
```
