# Twitter/X Video Processing Performance Plan

## Purpose

Improve the latency and throughput of Soulbot's Twitter/X video renderer without reducing visual quality, audio quality, Discord compatibility, or operational reliability.

This plan deliberately separates low-risk overhead removal from changes to FFmpeg media handling. Every development phase ends with a stop gate: deploy that phase to the real Soulbot service on `shinralabs`, run smoke tests and a repeatable benchmark there, review the evidence, and only then begin the next phase.

## Current production path

The current path is:

1. Download the source MP4 to `/tempdata`.
2. Probe the downloaded video for duration.
3. Render the static tweet canvas PNG.
4. Hash the video and canvas for diagnostic logging.
5. Remux the source into a normalized MP4 with copied video and audio streams.
6. Probe the normalized MP4 for stream, duration, frame-rate, and timestamp data.
7. Scale and composite the normalized video over the canvas.
8. Encode H.264 with `libx264`, preset `veryfast`, CRF 22, and `yuv420p`; encode audio as AAC 128 kbps at 48 kHz.
9. Probe the output multiple times, upload it to Discord, and remove the working directory.

Relevant implementation:

- `features/twitter-core/twitter_video_handler.js`
- `features/twitter-video/index.js`
- `features/twitter-video/debug_bake_img-in-vid.js`
- `features/twitter-video/twitter_video_canvas.js`
- `features/twitter-core/estimate_output_size.js`
- `features/twitter-core/twitter_video_render_registry.js`

Production was verified as CPU-only on `shinralabs`: the container uses `runc`, has no NVIDIA devices, and writes `/tempdata` through Docker's overlay filesystem. Prior controlled testing also found `libx264` faster than NVENC for this small scale-and-overlay workload, so GPU enablement is not part of this plan.

## Rules shared by every phase

### Preserve the output contract

Unless a phase explicitly tests a media-path alternative, retain:

- Current frame-rate selection behavior, including handling of variable-frame-rate inputs.
- Current output geometry and canvas composition.
- H.264 `libx264`, preset `veryfast`, CRF 22, and `yuv420p`.
- Current AAC settings where audio must be encoded.
- `faststart`, Discord upload-limit enforcement, no-progress watchdog behavior, single-flight deduplication, cleanup, deployment draining, and FIXUPX fallbacks.
- The current maximum of three concurrent render working directories until the concurrency phase.

### Use one benchmark corpus

Check a fixed corpus into test fixtures or define a durable host-local benchmark manifest. It should include at least:

- Short landscape video with AAC audio.
- Short portrait video with AAC audio.
- Silent video.
- Variable-frame-rate video.
- Video with non-zero or negative stream timestamps.
- Video whose audio and video start times differ.
- Near-60-second video.
- Video whose rendered result approaches the base Discord upload limit.
- The existing `1486771164475232260.json` and `xK7yRU3Nrmk09DJS.mp4` fixture used by the prior encoder benchmark.

Do not benchmark live CDN download variance as if it were encoder performance. Record download time separately, and reuse local source fixtures for renderer comparisons.

### Record stage-level measurements

For every benchmark run, emit structured timings for:

- Download.
- Initial probe.
- Canvas creation.
- Input hashing, while it still exists.
- Normalization/remux.
- Normalized-input probe.
- Composite encode.
- Output validation probe.
- Discord upload.
- Cleanup.
- End-to-end time.

Also record input/output bytes, duration, resolution, average and nominal frame rate, codecs, audio/video start-time delta, FFmpeg exit status, watchdog activity, and whether a fallback was used.

Run a warm-up followed by at least five measured iterations per corpus item. Report median, p95, minimum, maximum, and failure count rather than only an average.

### Quality and reliability checks

For phases capable of changing media output, compare candidate output to the baseline using:

- Identical output dimensions, intended duration, and stream presence.
- No new FFmpeg decode errors.
- Frame-level SSIM or an equivalent objective comparison at representative points.
- Manual inspection of the first, middle, and final frames.
- Manual audio/video synchronization checks at the start and near the end.
- Successful Discord upload, inline playback, seeking, audio playback, and thumbnail generation.
- Correct behavior for silent input and near-limit output.

Any crash, stuck job, missing/truncated audio, material sync regression, playback incompatibility, cleanup leak, or unexpected quality regression blocks advancement.

## Phase 0: Establish a trustworthy production baseline

### Development

- Add a repeatable benchmark command that exercises the real production renderer with the fixed corpus.
- Add structured stage timers without changing rendering behavior.
- Include a benchmark/run identifier so concurrent production logs can be separated.
- Preserve the existing operational progress messages; benchmark telemetry must not create extra Discord API traffic.
- Document the exact production image ID, commit, FFmpeg version, host CPU, container runtime, and relevant environment toggles with each benchmark result.

### Local verification

- Unit-test timing/result aggregation and failure reporting.
- Run the complete Jest and ESLint checks.
- Confirm instrumentation does not change output dimensions, duration, codecs, or bytes for deterministic fixtures.

### `shinralabs` stop gate

1. Deploy Phase 0 by the normal blue/green process and confirm graceful draining.
2. Post ordinary video, silent video, portrait video, and duplicate simultaneous links through the real Discord integration.
3. Verify progress updates, duplicate single-flight behavior, upload, playback, and cleanup.
4. Run the fixed corpus benchmark with no unrelated video jobs active.
5. Save the raw benchmark JSON and a summarized baseline artifact.
6. Stop. Review the stage breakdown before approving Phase 1.

### Advancement criteria

- All smoke cases succeed.
- No behavioral or output regression from instrumentation.
- Benchmark results are reproducible enough to identify the meaningful stages.

## Phase 1: Remove diagnostic and probe overhead

This phase must not alter the FFmpeg filter graph or encode settings.

### Development

- Remove unconditional SHA-1 reads of the source video and canvas from production rendering. Retain them only behind an explicit diagnostic flag if still useful.
- Make `getVideoFileSize()` use filesystem `stat` only.
- Remove duplicate post-encode probes while retaining exactly one awaited validation probe.
- Remove the download-duration probe if its result remains unused, or merge duration enforcement into the one input/normalized-input probe.
- Make verbose stream dumps and per-progress console logging opt-in while retaining concise start, completion, failure, watchdog, and size-limit logs.
- Keep output validation awaited so a malformed output cannot be announced as successful.

### Local verification

- Prove the generated FFmpeg command and output bytes are unchanged for deterministic fixtures.
- Test validation failure, watchdog failure, oversize abort, duplicate rendering, and cleanup paths.
- Run the complete repository checks.

### `shinralabs` stop gate

1. Deploy Phase 1 and repeat the Phase 0 Discord smoke suite.
2. Run the identical benchmark corpus and iteration count.
3. Compare stage and end-to-end median/p95 against Phase 0.
4. Verify output metadata and deterministic fixture hashes remain unchanged where expected.
5. Confirm reduced probe/process counts from structured logs.
6. Stop. Keep Phase 1 only if it is neutral or faster and equally reliable.

### Rollback criteria

- Output validation becomes weaker or asynchronous.
- Any render is uploaded before validation completes.
- Any fixture output changes despite an unchanged media command.
- Median or p95 performance regresses beyond ordinary benchmark variance.

## Phase 2: Make downloading backpressure-safe

### Development

- Replace the manual `fileStream.write()` loop with Node's awaited stream pipeline and a web-stream adapter.
- Preserve HTTP status validation and ensure partial files are removed on fetch, stream, disk, cancellation, or timeout failure.
- Add explicit download timeout and cancellation wiring compatible with deployment draining.
- Attach download byte counts and elapsed time to structured telemetry.
- Do not introduce an in-memory whole-file buffer.

### Local verification

- Test slow consumers, backpressure, interrupted responses, premature close, non-2xx responses, timeout, and cleanup.
- Verify successful downloads are byte-identical to their sources.
- Run the complete repository checks.

### `shinralabs` stop gate

1. Deploy Phase 2 and repeat the Discord smoke suite.
2. Run the fixed local-fixture renderer benchmark to prove encode performance did not regress.
3. Separately run controlled downloads against stable source objects of several sizes.
4. Run two and three concurrent downloads/renders while watching container memory and host I/O.
5. Confirm interruption leaves no partial working directory and deployment draining remains clean.
6. Stop. Review memory, latency, and cleanup evidence before Phase 3.

### Advancement criteria

- Downloaded bytes remain identical.
- Peak memory is stable under concurrency and no larger than the Phase 1 baseline beyond measurement noise.
- All failure paths clean up and return the existing user-facing fallback behavior.

## Phase 3: Avoid normalization for demonstrably safe inputs

This is the first phase that may change the media command. Treat it as an experiment with a conservative default.

### Development

- Extract normalization decisions into a pure, unit-tested classifier based on one input probe.
- Define the exact conditions under which the source is safe to compose directly, including valid duration, sane time base/frame rate, non-problematic start timestamps, supported container/codecs, and acceptable audio/video start delta.
- Keep the existing normalization path as the default for unknown, malformed, or borderline inputs.
- Add an environment-controlled kill switch that forces normalization for every video.
- Record the classifier decision and reason without dumping full probe payloads.
- Do not change output codec, CRF, preset, pixel format, frame rate, geometry, audio policy, or upload checks.

### Local verification

- Build classifier fixtures for each safe and unsafe condition.
- Confirm all timestamp-offset, variable-frame-rate, unusual time-base, and malformed fixtures choose normalization until specifically proven safe.
- Compare direct and normalized outputs with metadata, frame inspection, objective visual comparison, and A/V sync checks.
- Run fault-injection coverage and the complete repository checks.

### `shinralabs` stop gate

1. Deploy with forced normalization first and repeat the smoke suite.
2. Run the corpus baseline in forced-normalization mode.
3. Enable conditional normalization and rerun the identical corpus.
4. Confirm safe fixtures bypass normalization and unsafe fixtures retain it.
5. Perform real Discord playback, seeking, thumbnail, final-frame, and A/V sync checks for both paths.
6. Compare median/p95 by classifier path and inspect every failure or fallback.
7. Stop. Do not begin Phase 4 until conditional normalization has operated without regression and the kill switch has been exercised successfully.

### Rollback criteria

- Any direct-path output has broken playback, seeking, duration, final frames, audio, or synchronization.
- Classification cannot confidently explain its decision.
- Savings are negligible compared with the added branch complexity.

## Phase 4: Avoid unnecessary audio re-encoding

This phase is optional and should proceed only if Phase 0 telemetry shows audio processing is material.

### Development

- Define a narrowly safe passthrough case, initially limited to Discord-compatible AAC audio with acceptable sample rate/channel layout and effectively aligned audio/video starts.
- Keep AAC 128 kbps/48 kHz encoding for offset, incompatible, malformed, or uncertain audio.
- Preserve the existing audio delay/reset corrections whenever needed.
- Add a kill switch that forces audio encoding.
- Record the chosen audio path and reason.

### Local verification

- Test aligned AAC, offset AAC, non-AAC, unusual sample rate, mono/stereo, silent, shorter audio, longer audio, and malformed audio.
- Confirm passthrough is bit-preserving and encoded cases match existing synchronization behavior.
- Verify Discord compatibility and run the complete repository checks.

### `shinralabs` stop gate

1. Deploy with forced audio encoding and run smoke tests.
2. Benchmark the corpus with forced encoding, then with conditional passthrough.
3. Manually verify playback and sync for every audio category in Discord.
4. Compare latency, CPU, output size, and audio quality.
5. Stop. Drop this phase if the gain is not material or the compatibility matrix becomes fragile.

## Phase 5: Tune concurrency and temporary storage

Do this last so earlier stage improvements are not confused with host-level changes.

### Development and infrastructure experiment

- Replace directory-count capacity inference with an explicit in-process render semaphore integrated with the media-work registry.
- Ensure stale directories cannot consume capacity and duplicate followers do not consume render slots.
- Benchmark per-job FFmpeg thread limits against the existing automatic threading.
- Compare one, two, and three concurrent renders for both individual latency and total throughput.
- Evaluate a bounded `/tempdata` volume or tmpfs only after measuring real file sizes and peak concurrent storage. A tmpfs must have a hard size limit and must not threaten container or host memory.
- Preserve the existing capacity response, graceful drain behavior, watchdog, and cleanup guarantees.

### Local verification

- Test semaphore acquisition/release on success, failure, timeout, cancellation, duplicate follower, and shutdown.
- Test stale-directory independence and cleanup.
- Run the complete repository checks.

### `shinralabs` stop gate

1. Deploy the explicit semaphore without changing concurrency and repeat smoke tests.
2. Benchmark concurrency levels one, two, and three with the fixed corpus.
3. Record per-job median/p95, total batch completion, CPU utilization, memory, disk I/O, failures, watchdogs, and Discord API errors.
4. If testing storage changes, change only storage, redeploy, and repeat the identical matrix.
5. Exercise deployment draining while renders are active.
6. Stop and choose the configuration that improves throughput without unacceptable tail latency or host contention.

### Rollback criteria

- Lost permits, stuck jobs, incorrect capacity responses, stale temp data, or failed draining.
- Higher throughput accompanied by unacceptable p95 latency, error rate, or impact on other `shinralabs` services.
- Unbounded or unsafe memory-backed temporary storage.

## Final acceptance and cleanup

After all approved phases:

1. Run the entire corpus against the original Phase 0 baseline and the final candidate.
2. Repeat real Discord smoke tests for ordinary, portrait, silent, timestamp-offset, near-limit, duplicate, concurrent, interrupted, and deployment-drain cases.
3. Verify no quality, synchronization, playback, upload-limit, cleanup, or fallback regressions.
4. Document final median/p95 improvements by stage and end to end.
5. Remove temporary benchmark toggles that are no longer useful, but retain operational kill switches for conditional normalization and audio passthrough.
6. Keep the benchmark harness and corpus as regression tooling for future FFmpeg, Node, base-image, or host changes.

## Proposed delivery sequence

Each phase should be its own narrow review branch and deployment decision:

1. `perf/twitter-video-baseline-instrumentation`
2. `perf/twitter-video-remove-debug-overhead`
3. `perf/twitter-video-download-pipeline`
4. `perf/twitter-video-conditional-normalization`
5. `perf/twitter-video-audio-passthrough` if justified by telemetry
6. `perf/twitter-video-concurrency-storage`

Do not stack the next phase before the preceding branch has passed its `shinralabs` stop gate. This keeps every performance result attributable, every rollback small, and every reliability decision evidence-based.
