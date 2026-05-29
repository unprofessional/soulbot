const PromiseQueue = require('../../lib/promise_queue');
const { sendWebhookReplacementBatch } = require('../twitter-core/webhook_utils.js');
const {
    improveEnglishText,
    normalizeWhitespace,
} = require('../twitter-core/translation_service.js');

const ROLE_NAME = 'speak-english';
const BUFFER_WINDOW_MS = 5000;
const queue = new PromiseQueue(1, 30000);
const pendingByBucketId = new Map();
const CODE_BLOCK_RE = /```[\s\S]*?```|`[^`\n]+`/g;
const URL_RE = /https?:\/\/\S+/gi;

function getRoleNames(member) {
    const roles = member?.roles?.cache;
    if (!roles) return [];

    return Array.from(roles.values()).map(role => String(role?.name || '').toLowerCase());
}

function hasSpeakEnglishRole(member) {
    return getRoleNames(member).includes(ROLE_NAME);
}

function shouldProcessMessage(message) {
    if (!message || message.author?.bot) return false;
    if (!message.guild) return false;

    const content = normalizeWhitespace(message.content || '');
    if (!content) return false;
    if (!hasQualifyingText(content)) return false;

    return true;
}

function stripDisqualifyingContent(text) {
    return normalizeWhitespace(
        String(text || '')
            .replace(CODE_BLOCK_RE, ' ')
            .replace(URL_RE, ' ')
    );
}

function hasQualifyingText(text) {
    const stripped = stripDisqualifyingContent(text);
    if (!stripped) return false;
    return stripped.length > 0;
}

function buildBucketId(message) {
    return `${message.guildId || 'dm'}:${message.channelId || 'unknown'}:${message.author.id}`;
}

function getPendingBucket(message) {
    return pendingByBucketId.get(buildBucketId(message)) || null;
}

function clearPendingBuffers() {
    for (const bucket of pendingByBucketId.values()) {
        if (bucket?.timer) clearTimeout(bucket.timer);
    }
    pendingByBucketId.clear();
}

async function flushPendingBucket(bucketId) {
    const bucket = pendingByBucketId.get(bucketId);
    if (!bucket) return;

    pendingByBucketId.delete(bucketId);

    const sourceText = bucket.messages
        .map(message => normalizeWhitespace(message.content || ''))
        .filter(Boolean)
        .join('\n');

    if (!sourceText) return;

    try {
        const improvedText = await queue.add(() => improveEnglishText({
            text: sourceText,
            log: (msg) => console.log('[SpeakEnglish]', msg),
        }));

        if (!improvedText) return;
        if (normalizeWhitespace(improvedText) === sourceText) return;

        await sendWebhookReplacementBatch(bucket.messages, improvedText);
    } catch (err) {
        console.error('>>> flushPendingBucket error:', err);
    }
}

function enqueueSpeakEnglishMessage(message) {
    const bucketId = buildBucketId(message);
    const existing = pendingByBucketId.get(bucketId);

    if (existing) {
        existing.messages.push(message);
        return;
    }

    const timer = setTimeout(() => {
        flushPendingBucket(bucketId).catch(err => {
            console.error('>>> enqueueSpeakEnglishMessage flush error:', err);
        });
    }, BUFFER_WINDOW_MS);
    timer.unref?.();

    pendingByBucketId.set(bucketId, {
        timer,
        messages: [message],
    });
}

async function handleSpeakEnglishRole(message) {
    if (!shouldProcessMessage(message)) return;

    try {
        const member = message.member || await message.guild.members.fetch(message.author.id);
        if (!hasSpeakEnglishRole(member)) return;
        enqueueSpeakEnglishMessage(message);
    } catch (err) {
        console.error('>>> handleSpeakEnglishRole error:', err);
    }
}

module.exports = {
    buildBucketId,
    clearPendingBuffers,
    enqueueSpeakEnglishMessage,
    flushPendingBucket,
    getRoleNames,
    getPendingBucket,
    hasSpeakEnglishRole,
    handleSpeakEnglishRole,
    shouldProcessMessage,
    hasQualifyingText,
    stripDisqualifyingContent,
};
