const {
    createVideoPerformanceTelemetry,
    summarizeBenchmarkRuns,
} = require('../features/twitter-video/performance_telemetry.js');

describe('video performance telemetry', () => {
    test('records successful and failed stages as structured events', async () => {
        const logs = [];
        const telemetry = createVideoPerformanceTelemetry({
            runId: 'run-1',
            context: { source: 'test' },
            logger: line => logs.push(JSON.parse(line)),
        });

        await expect(telemetry.measure('working', async () => 42)).resolves.toBe(42);
        await expect(telemetry.measure('broken', async () => {
            throw new Error('nope');
        })).rejects.toThrow('nope');
        const summary = telemetry.finish('failed');

        expect(summary.stages).toEqual(expect.arrayContaining([
            expect.objectContaining({ stage: 'working', status: 'ok' }),
            expect.objectContaining({ stage: 'broken', status: 'failed', error: 'nope' }),
        ]));
        expect(logs.map(entry => entry.type)).toEqual(['start', 'stage', 'stage', 'summary']);
    });

    test('summarizes median, p95, min, max, and failures', () => {
        const runs = [10, 20, 30, 40, 100].map((durationMs, index) => ({
            status: 'ok',
            durationMs,
            stages: [{ stage: 'encode', status: 'ok', durationMs: durationMs / 2 }],
            index,
        }));
        runs.push({ status: 'failed', durationMs: 5, stages: [] });

        expect(summarizeBenchmarkRuns(runs)).toEqual({
            runs: 6,
            successes: 5,
            failures: 1,
            durationMs: { count: 5, min: 10, median: 30, p95: 100, max: 100 },
            stages: {
                encode: { count: 5, min: 5, median: 15, p95: 50, max: 50 },
            },
        });
    });
});
