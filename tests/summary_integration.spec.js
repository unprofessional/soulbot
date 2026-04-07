const { getSummaryContext } = require('../store/services/messages.service');
const { summarizeChat } = require('../features/ollama');

const RUN_SUMMARY_INTEGRATION = process.env.RUN_SUMMARY_INTEGRATION === '1';
const CHANNEL_ID = process.env.SUMMARY_CHANNEL_ID || '1481343741712400506';
const RUN_COUNT = Number(process.env.SUMMARY_INTEGRATION_RUNS || 3);

function normalizeSummary(summary) {
    return summary.replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractMentions(summary) {
    return Array.from(summary.matchAll(/<@(\d+)>/g), (match) => match[1]);
}

const maybeDescribe = RUN_SUMMARY_INTEGRATION ? describe : describe.skip;

maybeDescribe('summary integration', () => {
    jest.setTimeout(300000);

    test(`runs ${RUN_COUNT} live summary generations for channel ${CHANNEL_ID}`, async () => {
        const summaryContext = await getSummaryContext({ channelId: CHANNEL_ID, limit: 100 });

        expect(summaryContext).toEqual(expect.objectContaining({
            mode: expect.stringMatching(/^(full|delta)$/),
            messages: expect.any(Array),
        }));
        if (summaryContext.messages.length > 0) {
            expect(summaryContext.messages[0]).toEqual(expect.objectContaining({
                user_id: expect.any(String),
                content: expect.any(String),
            }));
        }
        if (summaryContext.mode === 'delta') {
            expect(summaryContext.previousSummary).toEqual(expect.any(String));
        }

        const summaries = [];

        for (let runIndex = 0; runIndex < RUN_COUNT; runIndex += 1) {
            const summary = await summarizeChat(summaryContext);
            summaries.push(summary);
            console.log(`\n[summary integration] run ${runIndex + 1}/${RUN_COUNT}\n${summary}\n`);
        }

        const normalizedSummaries = summaries.map(normalizeSummary);
        const uniqueSummaries = new Set(normalizedSummaries);
        const mentionsByRun = summaries.map(extractMentions);

        console.log('[summary integration] mode:', summaryContext.mode);
        console.log('[summary integration] messages in context:', summaryContext.messages.length);
        console.log('[summary integration] unique summary count:', uniqueSummaries.size);
        console.log('[summary integration] mentions by run:', JSON.stringify(mentionsByRun));

        expect(summaries).toHaveLength(RUN_COUNT);
        expect(summaries.every((summary) => typeof summary === 'string' && summary.trim().length > 0)).toBe(true);
    });
});
