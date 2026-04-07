const {
    buildSummaryPrompt,
    formatSummaryMessages,
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

    test('buildSummaryPrompt explains the compact line format', () => {
        const prompt = buildSummaryPrompt([
            { user_id: '111', content: 'hello there' },
            { user_id: '333', content: 'general kenobi' },
        ]);

        expect(prompt).toContain('Each chat line below is formatted as "userId: message content".');
        expect(prompt).toContain('111: hello there');
        expect(prompt).toContain('333: general kenobi');
        expect(prompt).not.toContain('created_at');
    });
});
