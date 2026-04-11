const PromiseQueue = require('../../lib/promise_queue');
const { sendWebhookReplacementMsg } = require('../twitter-core/webhook_utils.js');
const {
    improveEnglishText,
    normalizeWhitespace,
} = require('../twitter-core/translation_service.js');

const ROLE_NAME = 'speak-english';
const COOLDOWN_MS = 5000;
const queue = new PromiseQueue(1, 30000);
const lastReplyAtByUserId = new Map();
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
    if (content.length < 4) return false;
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
    return stripped.length >= 4;
}

function isOnCooldown(userId, now = Date.now()) {
    const lastReplyAt = lastReplyAtByUserId.get(String(userId));
    if (!Number.isFinite(lastReplyAt)) return false;
    return (now - lastReplyAt) < COOLDOWN_MS;
}

function markCooldown(userId, now = Date.now()) {
    lastReplyAtByUserId.set(String(userId), now);
}

function clearCooldowns() {
    lastReplyAtByUserId.clear();
}

async function handleSpeakEnglishRole(message) {
    if (!shouldProcessMessage(message)) return;

    try {
        const member = message.member || await message.guild.members.fetch(message.author.id);
        if (!hasSpeakEnglishRole(member)) return;
        if (isOnCooldown(message.author.id)) return;

        const sourceText = normalizeWhitespace(message.content || '');
        const improvedText = await queue.add(() => improveEnglishText({
            text: sourceText,
            log: (msg) => console.log('[SpeakEnglish]', msg),
        }));

        if (!improvedText) return;
        if (normalizeWhitespace(improvedText) === sourceText) return;

        markCooldown(message.author.id);
        await sendWebhookReplacementMsg(message, improvedText);
    } catch (err) {
        console.error('>>> handleSpeakEnglishRole error:', err);
    }
}

module.exports = {
    getRoleNames,
    hasSpeakEnglishRole,
    handleSpeakEnglishRole,
    isOnCooldown,
    markCooldown,
    clearCooldowns,
    shouldProcessMessage,
    hasQualifyingText,
    stripDisqualifyingContent,
};
