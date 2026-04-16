const {
    buildLlmMemoryPrompt,
    buildLlmReplyPrompt,
    buildSummaryPrompt,
    buildSummaryIntelligence,
    formatSummaryMessages,
    isLowSignalContent,
    isUrlOnlyContent,
    isGemma4Model,
    isQwenModel,
    normalizeSummaryContext,
    sanitizeThinkingOutput,
    scoreSummaryMessages,
    selectMessagesForPrompt,
    stripSummaryPrefix,
    summarizeRecentSummaryPhrases,
    summarizeSoulbotAwareness,
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
            summaryHistory: [],
        });
    });

    test('stripSummaryPrefix removes the Discord heading before prompting', () => {
        expect(stripSummaryPrefix('**Summary:**\nSomething happened')).toBe('Something happened');
    });

    test('detects url-only and low-signal content', () => {
        expect(isUrlOnlyContent('https://x.com/test/status/123')).toBe(true);
        expect(isUrlOnlyContent('hello https://x.com/test/status/123')).toBe(false);
        expect(isLowSignalContent('<:sideeye:1346560987737755688>')).toBe(true);
        expect(isLowSignalContent('actual sentence here')).toBe(false);
    });

    test('scores discussion higher than bare links', () => {
        const scored = scoreSummaryMessages([
            { user_id: '111', content: 'https://x.com/test/status/123' },
            { user_id: '111', content: 'the server upgrade is moving and the database is huge now' },
        ]);

        expect(scored[1].score).toBeGreaterThan(scored[0].score);
    });

    test('selectMessagesForPrompt keeps the highest-signal messages while preserving chronology', () => {
        const selected = selectMessagesForPrompt([
            { user_id: '111', content: 'https://x.com/test/status/123' },
            { user_id: '111', content: 'server upgrade is happening and the database is huge' },
            { user_id: '222', content: 'fishing rivalry continues in a surprisingly hostile way' },
        ], 2);

        expect(selected).toEqual([
            { user_id: '111', content: 'server upgrade is happening and the database is huge' },
            { user_id: '222', content: 'fishing rivalry continues in a surprisingly hostile way' },
        ]);
    });

    test('buildSummaryIntelligence derives participants, topics, and continuity', () => {
        const intelligence = buildSummaryIntelligence({
            mode: 'delta',
            previousSummary: '**Summary:**\nserver and fishing nonsense',
            summaryHistory: [
                { content: '**Summary:**\nserver and fishing nonsense' },
                { content: '**Summary:**\nmore server chatter' },
            ],
            messages: [
                { user_id: '111', content: 'server upgrade is happening now' },
                { user_id: '222', content: 'fishing rivalry continues today' },
                { user_id: '111', content: 'database size is absurd now' },
            ],
        });

        expect(intelligence.dominantParticipants[0]).toContain('<@111>');
        expect(intelligence.dominantTopics.length).toBeGreaterThan(0);
        expect(intelligence.historyTopics).toContain('server');
        expect(['continuation', 'minor_drift', 'new_topic', 'minimal_change']).toContain(intelligence.conversationState);
    });

    test('summarizeSoulbotAwareness detects bot, summary, clanker, and direct mentions', () => {
        const awareness = summarizeSoulbotAwareness([
            { user_id: '111', content: 'good bot' },
            { user_id: '222', content: 'this summary is weird' },
            { user_id: '333', content: 'did we just get dissed by a clanker' },
            { user_id: '444', content: 'hey <@891854264845094922> wake up' },
        ]);

        expect(awareness.hasSoulbotReferences).toBe(true);
        expect(awareness.directMentions).toBe(1);
        expect(awareness.detectedLabels).toEqual(expect.arrayContaining(['bot', 'summary', 'clanker']));
    });

    test('summarizeRecentSummaryPhrases captures recent opener and closer wording', () => {
        const phrases = summarizeRecentSummaryPhrases([
            { content: '**Summary:**\nThe chat pivoted again. It is garbage as usual.' },
            { content: '**Summary:**\nSame old nonsense. Still a mess in here.' },
        ]);

        expect(phrases[0]).toEqual(expect.objectContaining({
            opener: 'The chat pivoted again',
        }));
        expect(phrases[0].closer).toContain('garbage as usual');
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
        expect(prompt).toContain('DominantParticipants:');
        expect(prompt).toContain('DominantTopics:');
        expect(prompt).toContain('You are SOULbot, user ID <@891854264845094922>');
        expect(prompt).toContain('avoid repeating the exact same setup or conclusion phrases');
    });

    test('buildSummaryPrompt adds /no_think for Qwen but not Gemma 4', () => {
        const summaryInput = {
            mode: 'full',
            messages: [
                { user_id: '111', content: 'hello there' },
            ],
        };

        expect(buildSummaryPrompt(summaryInput, 'qwen3:14b')).toContain('/no_think');
        expect(buildSummaryPrompt(summaryInput, 'supergemma4-26b-fixed:latest')).not.toContain('/no_think');
    });

    test('buildSummaryPrompt includes previous summary and only newer messages in delta mode', () => {
        const prompt = buildSummaryPrompt({
            mode: 'delta',
            previousSummary: '**Summary:**\nOld stuff happened',
            summaryHistory: [
                { content: '**Summary:**\nOld stuff happened' },
                { content: '**Summary:**\nThe chat pivoted again. It is garbage as usual.' },
            ],
            messages: [
                { user_id: '111', content: 'new detail about the bot summary clanker' },
            ],
        });

        expect(prompt).toContain('You are updating a Discord chat summary.');
        expect(prompt).toContain('PreviousSummary:');
        expect(prompt).toContain('Old stuff happened');
        expect(prompt).not.toContain('**Summary:**');
        expect(prompt).toContain('NewMessagesSinceLastSummary:');
        expect(prompt).toContain('111: new detail about the bot summary clanker');
        expect(prompt).toContain('HistoricalTopics:');
        expect(prompt).toContain('RecentSummaryOpeners:');
        expect(prompt).toContain('RecentSummaryClosers:');
        expect(prompt).toContain('SOULbotAwareness: referenced=true');
        expect(prompt).toMatch(/Focus on what changed since the last summary|Almost nothing meaningful changed/);
    });

    test('buildSummaryPrompt handles no-change delta mode explicitly', () => {
        const prompt = buildSummaryPrompt({
            mode: 'delta',
            previousSummary: '**Summary:**\nOld stuff happened',
            summaryHistory: [
                { content: '**Summary:**\nOld stuff happened' },
            ],
            messages: [],
        });

        expect(prompt).toContain('[none]');
        expect(prompt).toContain('There are no meaningful new chat lines since the last summary');
    });

    test('buildLlmReplyPrompt treats channel history and memory as optional context', () => {
        const prompt = buildLlmReplyPrompt({
            userId: '111',
            userPrompt: 'what do you think about this',
            memorySummary: 'User likes blunt answers and is debugging Discord commands.',
            channelMessages: [
                { user_id: '222', content: 'the deploy broke after the slash command rename' },
                { user_id: '333', content: 'we should inspect the command registration flow' },
            ],
            webpageContent: null,
        });

        expect(prompt).toContain('Only mention or comment on that channel history if it is clearly relevant');
        expect(prompt).toContain('UserMemorySummary:');
        expect(prompt).toContain('RecentChannelMessages:');
        expect(prompt).toContain('222: the deploy broke after the slash command rename');
        expect(prompt).toContain('LatestUserMessage:');
        expect(prompt).toContain('what do you think about this');
    });

    test('buildLlmMemoryPrompt rewrites a compact rolling user memory', () => {
        const prompt = buildLlmMemoryPrompt({
            previousSummary: 'User prefers concise answers and was debugging slash commands.',
            userPrompt: 'can you rename /llama to /llm',
            assistantResponse: 'I renamed the command and updated the context flow.',
        }, 'qwen3:14b');

        expect(prompt).toContain('You are maintaining a compact memory summary');
        expect(prompt).toContain('PreviousMemorySummary:');
        expect(prompt).toContain('User prefers concise answers');
        expect(prompt).toContain('LatestUserMessage:');
        expect(prompt).toContain('LatestAssistantReply:');
        expect(prompt).toContain('/no_think');
    });

    test('buildLlm prompts omit /no_think for Gemma 4', () => {
        const replyPrompt = buildLlmReplyPrompt({
            userId: '111',
            userPrompt: 'what do you think about this',
            memorySummary: 'User likes concise answers.',
            channelMessages: [],
            webpageContent: null,
        }, 'supergemma4-26b-fixed:latest');

        const memoryPrompt = buildLlmMemoryPrompt({
            previousSummary: 'User likes concise answers.',
            userPrompt: 'can you rename /llama to /llm',
            assistantResponse: 'I renamed the command.',
        }, 'supergemma4-26b-fixed:latest');

        expect(replyPrompt).not.toContain('/no_think');
        expect(memoryPrompt).not.toContain('/no_think');
    });

    test('model helpers detect Qwen and Gemma 4 families', () => {
        expect(isQwenModel('qwen3:14b')).toBe(true);
        expect(isQwenModel('supergemma4-26b-fixed:latest')).toBe(false);
        expect(isGemma4Model('supergemma4-26b-fixed:latest')).toBe(true);
        expect(isGemma4Model('gemma-4-31b-it')).toBe(true);
        expect(isGemma4Model('qwen3:14b')).toBe(false);
    });

    test('sanitizeThinkingOutput removes Gemma 4 empty thought wrappers and empty think tags', () => {
        expect(sanitizeThinkingOutput('<|channel|>thought\n<channel|>final answer', 'supergemma4-26b-fixed:latest'))
            .toBe('final answer');
        expect(sanitizeThinkingOutput('<think></think>final answer', 'qwen3:14b'))
            .toBe('final answer');
    });
});
