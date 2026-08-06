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

### What production verification proved

- The production Discord smoke suite passed with portrait, landscape, silent/GIF, and ordinary videos. Upload, playback, progress reporting, and cleanup all remained reliable.
- Simultaneous submissions of the same fresh X video from two servers produced one render and two delivered results, proving single-flight deduplication works across servers.
- The complete `shinralabs` baseline finished 35 of 35 measured renders successfully: five runs for each of the seven cases after one warm-up per case.
- Overall render time measured 2.11 seconds median and 5.01 seconds p95. Composite encoding dominated at 1.37 seconds median and 4.41 seconds p95, confirming that fixed diagnostic/probe overhead matters most for short inputs while encoding remains the main cost for substantial videos.
- The service remained healthy and both production and benchmark temporary directories were cleaned successfully.
- Raw and summarized baseline artifacts are preserved on `shinralabs` under `/home/rally/soulbot-benchmark-results/phase0/`.

### What this did not change

- Phase 0 did not make video rendering faster by itself. It established the production evidence and repeatable baseline required to prove whether later phases are genuinely faster.

## 2026-08-05 — Twitter/X video Phase 1 removes wasted work

Branch: `perf/twitter-video-remove-debug-overhead`
Commit: `24fb405` — `Reduce Twitter video diagnostic overhead`

### What we actually gained

- Normal production renders no longer launch three redundant FFprobe processes or read the complete source video and canvas solely to calculate diagnostic hashes.
- The one retained output validation is now blocking and rejects a missing video stream or invalid duration before Discord upload, making the streamlined path safer than the prior diagnostics-heavy path.
- Routine logs are concise enough to operate without emitting every FFmpeg command, stream dump, codec event, and progress event. Full diagnostics remain available through `TWIT_DEBUG=1`.
- Two complete Phase 1 host benchmarks finished 70 of 70 measured renders successfully. The first was about 4–5% faster than Phase 0 overall; the repeat was effectively neutral within host variance.
- All seven deterministic fixture outputs matched Phase 0 byte-for-byte. The repeated production smoke suite also passed portrait, landscape, silent/GIF, ordinary, and simultaneous cross-server duplicate requests with successful cleanup.
- Phase 1 evidence is preserved on `shinralabs` under `/home/rally/soulbot-benchmark-results/phase1/`.

### What this did not change

- Encoding remains the dominant cost. Phase 1 removed fixed overhead but did not change the media filter, codec, quality, audio, or normalization behavior, so its practical speedup is modest and most visible on short videos.
- The renderer-only benchmark bypasses download and Discord handler work. Production telemetry remains necessary to measure complete request latency.

## 2026-08-05 — Twitter/X video Phase 2 makes downloads failure-safe

Branch: `perf/twitter-video-download-pipeline`
Commit: `b2d607e` — `Harden Twitter video downloads`

### What we actually gained

- Video downloads now follow disk backpressure instead of letting a fast network response build an unbounded in-memory write queue. Concurrent downloads therefore have a predictable memory shape without buffering whole videos.
- Timeout, cancellation, HTTP, interrupted-response, premature-close, and disk-write failures remove partial files instead of leaving corrupt input behind for later processing or cleanup.
- Deployment jobs now carry a cancellation signal into downloads, and download telemetry records the actual transferred byte count alongside elapsed time.
- The complete local suite passed with byte-identical successful downloads and fault-injection coverage. The production smoke suite then passed the available portrait, landscape, silent/GIF, ordinary, and concurrent usage cases after deployment.

### What this did not prove yet

- A suitably large fresh X video was not available during the stop gate, so that specific smoke case was explicitly deferred to normal production observation. The bounded-memory behavior is covered locally; any source-specific large-video failure remains something to isolate from production telemetry.
- Phase 2 was reliability and memory hardening, not an encoder optimization. The fixed renderer benchmark remained green, but no meaningful encode-speed gain was expected.

## 2026-08-05 — Twitter/X video Phase 3 skips safe remux work

Branch: `perf/twitter-video-conditional-normalization`
Commit: `7101402` — `Skip normalization for safe Twitter videos`

### What we actually gained

- Ordinary, demonstrably safe H.264/AAC MP4 inputs can now go directly into composition instead of first launching a remux and a second probe. Inputs with uncertain time bases, variable frame rates, timestamp offsets, incompatible codecs, or malformed metadata keep the established normalization path.
- `TWIT_FORCE_NORMALIZATION=1` provides a verified immediate rollback to the old all-normalization behavior. The production service was successfully exercised in both forced and conditional modes.
- The production conditional smoke suite completed portrait, landscape, and silent/GIF renders successfully. One landscape input safely bypassed normalization; the portrait and silent inputs conservatively retained it for explicit classifier reasons. Every output encoded, validated, uploaded, and cleaned up.
- Identical 35-run `shinralabs` corpora completed without failure in both modes. Median was effectively neutral at 2.211 seconds forced versus 2.199 seconds conditional, while p95 improved from 5.531 to 5.354 seconds. Direct inputs avoided roughly 220–390 milliseconds of remux/probe work, but total latency remained dominated by video encoding and ordinary host variance.
- Direct and normalized local outputs retained matching dimensions, streams, and duration with SSIM above 0.999. Phase 3 artifacts are preserved under `/home/rally/soulbot-benchmark-results/phase3/`.

### What this did not prove yet

- The cross-server duplicate smoke was intentionally deferred to the final end-to-end gate because repeating it during every phase created disproportionate manual work.
- Conditional normalization removes fixed work for eligible inputs; it does not accelerate the composite encode that dominates longer videos.
- Audio passthrough was skipped because telemetry did not identify audio encoding as a material independent bottleneck. Its likely marginal gain did not justify additional A/V synchronization and Discord compatibility risk.

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
