const {
    ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaGenerateEndpoint, soulbotUserId,
} = require('../../config/env_config.js');
const { chatModel, summaryModel, contextSize } = require('../../config/system_constants.js');
const { queryChromaDb } = require('./embed.js');

const processChunks = async (ollamaResponse) => {
    const reader = ollamaResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let responseText = '';
    let fullContent = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseText += decoder.decode(value, { stream: true });

        // Process each JSON line in the stream
        const lines = responseText.split('\n').filter(line => line.trim()); // Handle multiple chunks
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line); // Parse JSON chunk
                if (parsed.message && parsed.message.content) {
                    fullContent += parsed.message.content; // Concatenate content
                }
            } catch (err) {
                console.error('Error parsing chunk:', line, err);
            }
        }

        // Reset responseText after processing to handle partial messages correctly
        responseText = '';
    }
    return fullContent;
};

async function sendPromptToOllama(prompt, imagePath, intent) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;
    let finalUserPrompt = imagePath
        ? (prompt || 'Analyze this image. Please be brief and concise. If you do not know what it is, then just say so.')
        : prompt;
    if(intent === 'catvision') {
        finalUserPrompt = `You are assisting with categorizing images into categories for a database. 
Analyze the provided image and return suggested meta tags in JSON format. 

The tags should be single words or short phrases. 
Output the tags in the following JSON schema **and nothing else**:

{
  "suggestedTags": ["category1", "category2", "category3"]
}

Do not include explanations, descriptions, or any additional text. 
Your output should only contain valid JSON in the format provided.

Example input: An image of a dog playing in a park.
Example output:
{
  "suggestedTags": ["dog", "park", "play", "outdoor"]
}

Categorize the image now and follow the JSON schema strictly.
`;
    }
    const requestBody = {
        model: chatModel,
        messages: [
            {
                role: 'system',
                content: 'You are a sassy and condescending. ' +
                'Answer in plain text. Keep it simple and to the point. Do not exceed 2000 characters. ' + 
                'Each request is in a vacuum since you are being prompted in single-use sessions each time, therefore you cannot remember past references from the user. ' +
                'Answer questions about the world truthfully. ',
            },
            {
                role: 'user',
                content: finalUserPrompt,
                ...(imagePath && { images: [imagePath] }), // Conditionally add 'images' property
            },
        ],
        stream: false,
        keep_alive: -1, // Keep model in memory
    };

    console.log('>>>>> ollama > sendPromptToOllama > requestBody: ', requestBody);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        let fullContent = await processChunks(response);

        console.log('Full concatenated content:', fullContent);
        return fullContent; // Return the fully concatenated response
    } catch (error) {
        console.error('Error communicating with Ollama API:', error);
        throw error;
    }
}

function formatSummaryMessages(messages = []) {
    return messages
        .filter((msg) => msg?.user_id && typeof msg.content === 'string' && msg.content.trim())
        .map((msg) => `${msg.user_id}: ${msg.content.trim()}`)
        .join('\n');
}

const SUMMARY_STOPWORDS = new Set([
    'about', 'after', 'again', 'against', 'aint', 'all', 'also', 'and', 'any', 'are', 'back',
    'been', 'before', 'being', 'between', 'both', 'but', 'cant', 'come', 'could', 'did', 'didnt',
    'dont', 'down', 'even', 'first', 'for', 'from', 'get', 'got', 'had', 'has', 'have', 'hello',
    'her', 'here', 'hers', 'him', 'his', 'how', 'ill', 'im', 'into', 'its', 'ive', 'just', 'know',
    'like', 'lol', 'make', 'more', 'much', 'need', 'not', 'now', 'off', 'okay', 'only', 'other',
    'our', 'out', 'over', 'really', 'same', 'say', 'she', 'should', 'since', 'some', 'still',
    'than', 'that', 'thats', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
    'those', 'through', 'time', 'too', 'under', 'very', 'want', 'well', 'were', 'what', 'when',
    'where', 'which', 'while', 'who', 'with', 'would', 'yeah', 'you', 'your', 'yours',
]);

function stripSummaryPrefix(summary = '') {
    return summary.replace(/^\*\*Summary:\*\*\s*/i, '').trim();
}

function normalizeSummaryContext(summaryInput = []) {
    if (Array.isArray(summaryInput)) {
        return {
            mode: 'full',
            previousSummary: null,
            messages: summaryInput,
            lastSummaryCreatedAt: null,
            summaryHistory: [],
        };
    }

    return {
        mode: summaryInput.mode || 'full',
        previousSummary: summaryInput.previousSummary || null,
        messages: Array.isArray(summaryInput.messages) ? summaryInput.messages : [],
        lastSummaryCreatedAt: summaryInput.lastSummaryCreatedAt || null,
        summaryHistory: Array.isArray(summaryInput.summaryHistory) ? summaryInput.summaryHistory : [],
    };
}

function isUrlOnlyContent(content = '') {
    const trimmed = content.trim();
    if (!trimmed) return false;
    const withoutQuotes = trimmed
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('>>>'))
        .join(' ');

    if (!withoutQuotes) return false;

    return /^<?https?:\/\/\S+>?$/i.test(withoutQuotes);
}

function isLowSignalContent(content = '') {
    const trimmed = content.trim();
    if (!trimmed) return true;
    if (isUrlOnlyContent(trimmed)) return true;
    if (/^<a?:\w+:\d+>$/.test(trimmed)) return true;
    if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\W_]+$/u.test(trimmed)) return true;
    if (trimmed.length <= 3) return true;
    return false;
}

function tokenizeSummaryText(content = '') {
    const normalized = content
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/<@\d+>/g, ' ')
        .replace(/<a?:\w+:\d+>/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ');

    return normalized
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !SUMMARY_STOPWORDS.has(token) && !/^\d+$/.test(token));
}

function countMentionTokens(content = '') {
    return (content.match(/<@(\d+)>/g) || []).length;
}

function scoreSummaryMessages(messages = []) {
    const userCounts = new Map();
    const tokenCounts = new Map();
    const tokenizedMessages = messages.map((message) => {
        const content = message?.content || '';
        const tokens = tokenizeSummaryText(content);
        userCounts.set(message.user_id, (userCounts.get(message.user_id) || 0) + 1);
        new Set(tokens).forEach((token) => {
            tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
        });
        return tokens;
    });

    return messages.map((message, index) => {
        const content = (message?.content || '').trim();
        const tokens = tokenizedMessages[index];
        const uniqueRepeatedTokens = new Set(tokens.filter((token) => (tokenCounts.get(token) || 0) > 1));
        let score = 1;

        if (content.length >= 120) score += 3;
        else if (content.length >= 50) score += 2;
        else if (content.length >= 20) score += 1;

        score += Math.min(countMentionTokens(content), 2);
        score += Math.min((userCounts.get(message.user_id) || 0) - 1, 2);
        score += Math.min(uniqueRepeatedTokens.size, 3);

        if (content.includes('\n')) score += 1;
        if (/\breplied to\b/i.test(content)) score += 1;
        if (isUrlOnlyContent(content)) score -= 4;
        else if (isLowSignalContent(content)) score -= 3;

        return {
            ...message,
            score,
            index,
            tokens,
        };
    });
}

function selectMessagesForPrompt(messages = [], maxMessages = 20) {
    if (messages.length <= maxMessages) return messages;

    const scoredMessages = scoreSummaryMessages(messages);
    const selectedIndexes = new Set(
        scoredMessages
            .slice()
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, maxMessages)
            .map((message) => message.index)
    );

    return messages.filter((_, index) => selectedIndexes.has(index));
}

function summarizeParticipants(messages = [], limit = 3) {
    const counts = new Map();

    messages.forEach((message) => {
        if (!message?.user_id) return;
        counts.set(message.user_id, (counts.get(message.user_id) || 0) + 1);
    });

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([userId, count]) => `<@${userId}> x${count}`);
}

function summarizeTopics(messages = [], limit = 4) {
    const tokenCounts = new Map();

    messages.forEach((message) => {
        new Set(tokenizeSummaryText(message?.content || '')).forEach((token) => {
            tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
        });
    });

    return Array.from(tokenCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([token]) => token);
}

function summarizeHistoryTopics(summaryHistory = [], limit = 5) {
    const tokenCounts = new Map();

    summaryHistory.forEach((summary) => {
        new Set(tokenizeSummaryText(stripSummaryPrefix(summary?.content || ''))).forEach((token) => {
            tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
        });
    });

    return Array.from(tokenCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([token]) => token);
}

function summarizeRecentSummaryPhrases(summaryHistory = [], limit = 3) {
    return summaryHistory
        .map((summary) => stripSummaryPrefix(summary?.content || ''))
        .filter(Boolean)
        .slice(0, limit)
        .map((summary) => {
            const normalized = summary.replace(/\s+/g, ' ').trim();
            const opener = normalized.split(/[.!?]/)[0]?.trim() || '';
            const words = normalized.split(/\s+/).filter(Boolean);
            const closer = words.slice(-5).join(' ').trim();

            return {
                opener,
                closer,
            };
        });
}

function summarizeSoulbotAwareness(messages = []) {
    const awarenessTerms = ['bot', 'summary', 'clanker'];
    const matchingMessages = messages.filter((message) => {
        const content = (message?.content || '').toLowerCase();

        return content.includes(`<@${soulbotUserId}>`)
            || awarenessTerms.some((term) => content.includes(term));
    });

    const directMentions = matchingMessages.filter((message) =>
        (message?.content || '').includes(`<@${soulbotUserId}>`)
    ).length;

    const detectedLabels = awarenessTerms.filter((term) =>
        matchingMessages.some((message) => (message?.content || '').toLowerCase().includes(term))
    );

    return {
        soulbotUserId,
        hasSoulbotReferences: matchingMessages.length > 0,
        directMentions,
        detectedLabels,
        referenceCount: matchingMessages.length,
    };
}

function detectConversationState(summaryContext, currentTopics = [], historyTopics = []) {
    const messageCount = summaryContext.messages.length;

    if (summaryContext.mode === 'delta' && messageCount === 0) {
        return 'minimal_change';
    }

    const overlapCount = currentTopics.filter((topic) => historyTopics.includes(topic)).length;

    if (summaryContext.mode === 'delta') {
        if (messageCount <= 3) return 'minimal_change';
        if (overlapCount >= 2) return 'continuation';
        if (overlapCount >= 1) return 'minor_drift';
        return 'new_topic';
    }

    if (currentTopics.length >= 3) return 'mixed';
    return 'fresh_snapshot';
}

function buildSummaryIntelligence(summaryInput = []) {
    const summaryContext = normalizeSummaryContext(summaryInput);
    const selectedMessages = selectMessagesForPrompt(summaryContext.messages, 20);
    const dominantParticipants = summarizeParticipants(summaryContext.messages);
    const dominantTopics = summarizeTopics(summaryContext.messages);
    const historyTopics = summarizeHistoryTopics(summaryContext.summaryHistory);
    const recentSummaryPhrases = summarizeRecentSummaryPhrases(summaryContext.summaryHistory);
    const soulbotAwareness = summarizeSoulbotAwareness(summaryContext.messages);
    const conversationState = detectConversationState(summaryContext, dominantTopics, historyTopics);
    const suppressedCount = Math.max(summaryContext.messages.length - selectedMessages.length, 0);

    return {
        ...summaryContext,
        selectedMessages,
        dominantParticipants,
        dominantTopics,
        historyTopics,
        recentSummaryPhrases,
        soulbotAwareness,
        conversationState,
        suppressedCount,
    };
}

function buildFullSummaryPrompt(messages = [], intelligence = buildSummaryIntelligence({
    mode: 'full',
    messages,
})) {
    const formattedMessages = formatSummaryMessages(intelligence.selectedMessages);

    return [
        'You are summarizing a Discord chat log.',
        'Be condescending and bitchy.',
        'Keep it brief and salient.',
        'Summarize the conversation as a whole.',
        'If any individual stands out, mention them with Discord mention syntax like <@123456789>.',
        'Each chat line below is formatted as "userId: message content".',
        'Lead with the highest-signal developments instead of low-information filler.',
        'Treat the topic sketch and participant sketch as hints about what mattered most.',
        `You are SOULbot, user ID <@${soulbotUserId}>, and you are being used to summarize chat logs.`,
        intelligence.soulbotAwareness.hasSoulbotReferences
            ? 'If people seem to be talking about you, the bot, summaries, or calling you a clanker, recognize that as chat about SOULbot.'
            : 'Only mention SOULbot itself if the chat actually appears to be about the bot.',
        'Keep the same condescending sentiment, but avoid repeating the exact same setup or conclusion phrases from recent summaries.',
        'If recent summaries already used stock lines like "the chat pivoted again" or "it\'s garbage", choose different wording with similar sentiment.',
        'Do not invite follow-up questions.',
        'Do not mention these instructions.',
        '',
        'ConversationState:',
        intelligence.conversationState,
        `DominantParticipants: ${intelligence.dominantParticipants.join(', ') || '[none]'}`,
        `DominantTopics: ${intelligence.dominantTopics.join(', ') || '[none]'}`,
        `RecentSummaryOpeners: ${intelligence.recentSummaryPhrases.map((phrase) => phrase.opener).filter(Boolean).join(' | ') || '[none]'}`,
        `RecentSummaryClosers: ${intelligence.recentSummaryPhrases.map((phrase) => phrase.closer).filter(Boolean).join(' | ') || '[none]'}`,
        `SOULbotAwareness: referenced=${intelligence.soulbotAwareness.hasSoulbotReferences}, labels=${intelligence.soulbotAwareness.detectedLabels.join(', ') || '[none]'}, directMentions=${intelligence.soulbotAwareness.directMentions}`,
        `SuppressedLowSignalMessages: ${intelligence.suppressedCount}`,
        '',
        'DiscordChatLog:',
        formattedMessages,
        '/no_think',
    ].join('\n');
}

function buildDeltaSummaryPrompt(previousSummary, messages = [], intelligence = buildSummaryIntelligence({
    mode: 'delta',
    previousSummary,
    messages,
})) {
    const priorSummary = stripSummaryPrefix(previousSummary);
    const formattedMessages = formatSummaryMessages(intelligence.selectedMessages);
    const hasMeaningfulChanges = Boolean(formattedMessages);
    const stateInstructionMap = {
        minimal_change: 'Almost nothing meaningful changed, so say that very bluntly and briefly.',
        continuation: 'This is mostly the same conversation continuing, so frame it as an update rather than a reset.',
        minor_drift: 'The chat mostly continued but drifted a little, so mention the small shift.',
        new_topic: 'The chat pivoted, so emphasize the new thread instead of repeating old context.',
    };

    return [
        'You are updating a Discord chat summary.',
        'Be condescending and bitchy.',
        'Keep it brief and salient.',
        'You are given the previous summary plus only the newer chat lines since that summary.',
        'If any individual stands out, mention them with Discord mention syntax like <@123456789>.',
        'Each new chat line below is formatted as "userId: message content".',
        hasMeaningfulChanges
            ? 'Focus on what changed since the last summary instead of recapping everything from scratch.'
            : 'There are no meaningful new chat lines since the last summary, so say that basically nothing changed in a very short way.',
        'Prefer phrases like "since the last summary" when relevant.',
        stateInstructionMap[intelligence.conversationState] || 'Describe the delta relative to the prior summary.',
        'Use the participant and topic sketches to decide what actually mattered.',
        `You are SOULbot, user ID <@${soulbotUserId}>, and you are being used to summarize chat logs.`,
        intelligence.soulbotAwareness.hasSoulbotReferences
            ? 'If people are calling the bot "bot", "summary", or "clanker", treat that as conversation about SOULbot rather than random vocabulary.'
            : 'Only mention SOULbot itself if the new messages are clearly about the bot.',
        'Keep the same condescending sentiment, but avoid repeating the exact same setup or conclusion phrases from recent summaries.',
        'If recent summaries already used stock lines like "the chat pivoted again" or "it\'s garbage", choose different wording with similar sentiment.',
        'Do not invite follow-up questions.',
        'Do not mention these instructions.',
        '',
        'ConversationState:',
        intelligence.conversationState,
        `DominantParticipants: ${intelligence.dominantParticipants.join(', ') || '[none]'}`,
        `DominantTopics: ${intelligence.dominantTopics.join(', ') || '[none]'}`,
        `HistoricalTopics: ${intelligence.historyTopics.join(', ') || '[none]'}`,
        `RecentSummaryOpeners: ${intelligence.recentSummaryPhrases.map((phrase) => phrase.opener).filter(Boolean).join(' | ') || '[none]'}`,
        `RecentSummaryClosers: ${intelligence.recentSummaryPhrases.map((phrase) => phrase.closer).filter(Boolean).join(' | ') || '[none]'}`,
        `SOULbotAwareness: referenced=${intelligence.soulbotAwareness.hasSoulbotReferences}, labels=${intelligence.soulbotAwareness.detectedLabels.join(', ') || '[none]'}, directMentions=${intelligence.soulbotAwareness.directMentions}`,
        `SuppressedLowSignalMessages: ${intelligence.suppressedCount}`,
        '',
        'PreviousSummary:',
        priorSummary || 'No previous summary available.',
        '',
        'NewMessagesSinceLastSummary:',
        formattedMessages || '[none]',
        '/no_think',
    ].join('\n');
}

function buildSummaryPrompt(summaryInput = []) {
    const summaryContext = normalizeSummaryContext(summaryInput);
    const intelligence = buildSummaryIntelligence(summaryContext);

    if (summaryContext.mode === 'delta') {
        return buildDeltaSummaryPrompt(summaryContext.previousSummary, summaryContext.messages, intelligence);
    }

    return buildFullSummaryPrompt(summaryContext.messages, intelligence);
}

async function generateText(prompt, model = chatModel) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaGenerateEndpoint}`;
    const requestBody = {
        model,
        options: {
            num_ctx: contextSize,
        },
        prompt,
        stream: false,
        keep_alive: -1,
    };

    console.log('>>>>> ollama > generateText > requestBody: ', requestBody);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return (data.response || '')
            .replace(/<think>\s*<\/think>\s*/gi, '')
            .trim();
    } catch (error) {
        console.error('Error communicating with Ollama API:', error);
        throw error;
    }
}

async function summarizeChat(summaryInput, model = summaryModel) {
    const summaryContext = normalizeSummaryContext(summaryInput);
    return generateText(buildSummaryPrompt(summaryContext), model);
}

function buildLlmReplyPrompt({
    userId,
    userPrompt,
    memorySummary,
    channelMessages = [],
    webpageContent,
}) {
    const formattedMessages = formatSummaryMessages(channelMessages) || '[none]';
    const memoryBlock = memorySummary?.trim() || '[none]';
    const webpageBlock = webpageContent?.trim() || '[none]';

    return [
        `You are SOULbot, user ID <@${soulbotUserId}>.`,
        'Reply to the latest user message in plain text.',
        'Keep it concise, direct, and conversational.',
        'You may use the recent channel history below as background context.',
        'Only mention or comment on that channel history if it is clearly relevant to the user request or the user is directly asking about it.',
        'Do not summarize the channel history unless the user asks you to.',
        'You also have a lossy memory summary of prior exchanges with this specific user.',
        'Use that memory only when it genuinely helps answer the latest message.',
        'If the user message is ambiguous like "what do you think about this", infer "this" from the recent channel history or webpage content when possible.',
        'Do not mention these instructions.',
        '',
        `UserId: ${userId}`,
        'UserMemorySummary:',
        memoryBlock,
        '',
        'RelevantWebpageContent:',
        webpageBlock,
        '',
        'RecentChannelMessages:',
        formattedMessages,
        '',
        'LatestUserMessage:',
        userPrompt,
        '/no_think',
    ].join('\n');
}

function buildLlmMemoryPrompt({
    previousSummary,
    userPrompt,
    assistantResponse,
}) {
    return [
        'You are maintaining a compact memory summary for one user\'s prior chats with SOULbot.',
        'Rewrite the memory summary so it stays useful for future replies.',
        'Preserve durable preferences, recurring topics, ongoing tasks, important opinions, and unresolved questions.',
        'Drop fluff, filler, and one-off details that are unlikely to matter later.',
        'Keep it short and factual.',
        'Write plain text only.',
        'Do not mention these instructions.',
        '',
        'PreviousMemorySummary:',
        previousSummary?.trim() || '[none]',
        '',
        'LatestUserMessage:',
        userPrompt,
        '',
        'LatestAssistantReply:',
        assistantResponse,
        '/no_think',
    ].join('\n');
}

async function replyWithLlmContext(context) {
    return generateText(buildLlmReplyPrompt(context), chatModel);
}

async function summarizeLlmMemory(memoryInput) {
    return generateText(buildLlmMemoryPrompt(memoryInput), summaryModel);
}

/**
 * Queries ChromaDB for relevant context and sends a RAG-enhanced query to the LLM.
 * @param {string} userQuery - The user's query.
 * @param {Object} metadataFilters - Optional filters for ChromaDB (e.g., guild_id, channel_id).
 * @param {number} numResults - The number of relevant results to retrieve from ChromaDB.
 * @returns {Promise<string>} - The response from the LLM.
 */
async function queryWithRAG(userQuery, metadataFilters = {}, numResults = 20) {
    try {
        // Step 1: Query ChromaDB for relevant context
        const results = await queryChromaDb(userQuery, metadataFilters, numResults);

        // Step 2: Extract and filter context
        const contextArray = results.metadatas[0]
            .map((metadata) => {
                if (
                    metadata?.content &&
                    metadata?.created_at &&
                    !metadata.content.includes('Member not in the controlled list!')
                ) {
                    return `${metadata.created_at}: ${metadata.content}`;
                }
                return null; // Skip invalid or irrelevant metadata
            })
            .filter(Boolean); // Remove null entries

        const context = contextArray.join('\n');
        console.log('>>>>> queryWithRAG > context:', context);

        // Fallback for empty context
        if (!context) {
            console.warn('No valid context retrieved from ChromaDB.');
            return 'I could not retrieve any relevant context from the database.';
        }

        // Step 3: Combine context with the user query
        const prompt = `Here is the context:\n\n${context}\n\nUser Query: ${userQuery}\n\nProvide a response based on the context.`;

        // Step 4: Send the prompt to the LLM
        const response = await sendPromptToOllama(prompt);
        console.log('>>>>> queryWithRAG > LLM response:', response);
        return response;
    } catch (error) {
        console.error('Error performing RAG query with LLM:', error);
        throw error;
    }
}

module.exports = {
    buildSummaryPrompt,
    buildLlmMemoryPrompt,
    buildLlmReplyPrompt,
    buildSummaryIntelligence,
    buildDeltaSummaryPrompt,
    buildFullSummaryPrompt,
    detectConversationState,
    isLowSignalContent,
    isUrlOnlyContent,
    normalizeSummaryContext,
    formatSummaryMessages,
    scoreSummaryMessages,
    selectMessagesForPrompt,
    summarizeRecentSummaryPhrases,
    summarizeSoulbotAwareness,
    summarizeLlmMemory,
    summarizeParticipants,
    summarizeTopics,
    summarizeHistoryTopics,
    stripSummaryPrefix,
    generateText,
    processChunks,
    replyWithLlmContext,
    sendPromptToOllama,
    summarizeChat,
    queryWithRAG,
};
