const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');

const TELEMETRY_EVENT = 'twitter_video_performance';

function roundMilliseconds(value) {
    return Math.round(Number(value) * 100) / 100;
}

function createVideoPerformanceTelemetry({
    runId = crypto.randomBytes(6).toString('hex'),
    context = {},
    logger = console.log,
} = {}) {
    const startedAt = performance.now();
    const stages = [];

    const emit = (payload) => {
        logger(JSON.stringify({
            event: TELEMETRY_EVENT,
            runId,
            ...context,
            ...payload,
        }));
    };

    const recordStage = (stage, durationMs, status = 'ok', details = {}) => {
        const entry = {
            stage,
            durationMs: roundMilliseconds(durationMs),
            status,
            ...details,
        };
        stages.push(entry);
        emit({ type: 'stage', ...entry });
        return entry;
    };

    const measure = async (stage, operation, details = {}) => {
        const stageStartedAt = performance.now();
        try {
            const result = await operation();
            const stageDetails = typeof details === 'function' ? details(result) : details;
            recordStage(stage, performance.now() - stageStartedAt, 'ok', stageDetails);
            return result;
        } catch (error) {
            recordStage(stage, performance.now() - stageStartedAt, 'failed', {
                ...details,
                error: error?.message || String(error),
            });
            throw error;
        }
    };

    const finish = (status = 'ok', details = {}) => {
        const summary = {
            type: 'summary',
            status,
            durationMs: roundMilliseconds(performance.now() - startedAt),
            stages,
            ...details,
        };
        emit(summary);
        return { runId, ...summary };
    };

    emit({ type: 'start' });

    return {
        finish,
        measure,
        recordStage,
        runId,
        stages,
    };
}

function percentile(values, fraction) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
    return roundMilliseconds(sorted[index]);
}

function summarizeBenchmarkRuns(runs) {
    const successful = runs.filter(run => run.status === 'ok');
    const durationValues = successful.map(run => Number(run.durationMs));
    const stageNames = new Set(successful.flatMap(run => run.stages.map(stage => stage.stage)));
    const stages = {};

    for (const stageName of stageNames) {
        const values = successful.flatMap(run => run.stages
            .filter(stage => stage.stage === stageName && stage.status === 'ok')
            .map(stage => Number(stage.durationMs)));
        stages[stageName] = summarizeValues(values);
    }

    return {
        runs: runs.length,
        successes: successful.length,
        failures: runs.length - successful.length,
        durationMs: summarizeValues(durationValues),
        stages,
    };
}

function summarizeValues(values) {
    if (values.length === 0) {
        return { count: 0, min: null, median: null, p95: null, max: null };
    }
    return {
        count: values.length,
        min: roundMilliseconds(Math.min(...values)),
        median: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        max: roundMilliseconds(Math.max(...values)),
    };
}

module.exports = {
    TELEMETRY_EVENT,
    createVideoPerformanceTelemetry,
    summarizeBenchmarkRuns,
};
