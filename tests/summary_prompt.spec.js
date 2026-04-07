const {
    buildSummaryPrompt,
    formatSummaryMessages,
    normalizeSummaryContext,
    stripSummaryPrefix,
} = require('../features/ollama');

describe('summary prompt formatting', () => {
    test('formatSummaryMessages keeps only user ID and content', () => {
        const formatted = formatSummaryMessages([
            {
                user_id: '111',
                content: '  hello there  ',
                created_at: new Date('2026-04-07T00:00:00.000Z'),
            },
            {
                user_id: '222',
                content: '',
            },
            {
                user_id: '333',
                content: 'general kenobi',
                meta: { username: 'obiwan' },
            },
        ]);

        expect(formatted).toBe('111: hello there\n333: general kenobi');
        expect(formatted).not.toContain('created_at');
        expect(formatted).not.toContain('obiwan');
    });

    test('normalizeSummaryContext converts raw arrays into full-mode summary context', () => {
        expect(normalizeSummaryContext([
            { user_id: '111', content: 'hello there' },
        ])).toEqual({
            mode: 'full',
            previousSummary: null,
            messages: [{ user_id: '111', content: 'hello there' }],
            lastSummaryCreatedAt: null,
        });
    });

    test('stripSummaryPrefix removes the Discord heading before prompting', () => {
        expect(stripSummaryPrefix('**Summary:**\nSomething happened')).toBe('Something happened');
    });

    test('buildSummaryPrompt explains the compact full-summary line format', () => {
        const prompt = buildSummaryPrompt({
            mode: 'full',
            messages: [
                { user_id: '111', content: 'hello there' },
                { user_id: '333', content: 'general kenobi' },
            ],
        });

        expect(prompt).toContain('Each chat line below is formatted as "userId: message content".');
        expect(prompt).toContain('111: hello there');
        expect(prompt).toContain('333: general kenobi');
        expect(prompt).not.toContain('created_at');
    });

    test('buildSummaryPrompt includes previous summary and only newer messages in delta mode', () => {
        const prompt = buildSummaryPrompt({
            mode: 'delta',
            previousSummary: '**Summary:**\nOld stuff happened',
            messages: [
                { user_id: '111', content: 'new detail' },
            ],
        });

        expect(prompt).toContain('You are updating a Discord chat summary.');
        expect(prompt).toContain('PreviousSummary:');
        expect(prompt).toContain('Old stuff happened');
        expect(prompt).not.toContain('**Summary:**');
        expect(prompt).toContain('NewMessagesSinceLastSummary:');
        expect(prompt).toContain('111: new detail');
        expect(prompt).toContain('Focus on what changed since the last summary');
    });

    test('buildSummaryPrompt handles no-change delta mode explicitly', () => {
        const prompt = buildSummaryPrompt({
            mode: 'delta',
            previousSummary: '**Summary:**\nOld stuff happened',
            messages: [],
        });

        expect(prompt).toContain('[none]');
        expect(prompt).toContain('There are no meaningful new chat lines since the last summary');
    });
});
