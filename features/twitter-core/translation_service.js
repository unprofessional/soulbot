const {
    openAiApiKey,
    openAiOrganizationId,
    openAiProjectId,
    openAiTranslationModel,
} = require('../../config/env_config.js');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const ENGLISH_LANGUAGE_RE = /^en(?:[-_]|$)/i;
const translationCache = new Map();

function getSourceText(metadata) {
    const raw = metadata?.text ?? metadata?.full_text ?? metadata?.tweet?.text ?? '';
    return typeof raw === 'string' ? raw.trim() : '';
}

function normalizeWhitespace(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

function isEnglishLanguage(lang) {
    return typeof lang === 'string' && ENGLISH_LANGUAGE_RE.test(lang.trim());
}

function shouldTranslateMetadata(metadata) {
    if (!openAiApiKey) return false;
    if (!metadata || metadata.error) return false;
    if (metadata.translation?.text || metadata.translatedText) return false;

    const text = getSourceText(metadata);
    if (!text) return false;

    return Boolean(metadata.lang) && !isEnglishLanguage(metadata.lang);
}

function buildTranslationCacheKey(metadata) {
    const text = getSourceText(metadata);
    return [metadata?.tweetID || '', metadata?.lang || '', text].join('::');
}

function extractOutputText(payload) {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const output = Array.isArray(payload?.output) ? payload.output : [];
    for (const item of output) {
        const content = Array.isArray(item?.content) ? item.content : [];
        for (const block of content) {
            if (typeof block?.text === 'string' && block.text.trim()) {
                return block.text.trim();
            }
        }
    }

    return '';
}

async function translateTextToEnglish({ text, sourceLanguage, log = console.log }) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`,
    };

    if (openAiOrganizationId) headers['OpenAI-Organization'] = openAiOrganizationId;
    if (openAiProjectId) headers['OpenAI-Project'] = openAiProjectId;

    const payload = {
        model: openAiTranslationModel,
        reasoning: { effort: 'minimal' },
        instructions: [
            'Translate the provided social media post into natural English.',
            'Preserve meaning, tone, slang, line breaks, @mentions, hashtags, emojis, and proper nouns.',
            'Return only the translated English text.',
            'If the text is already effectively English, return it unchanged.',
        ].join(' '),
        input: [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: `Source language: ${sourceLanguage || 'unknown'}\n\nPost:\n${text}`,
                    },
                ],
            },
        ],
    };

    const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    let parsed;
    try {
        parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
        parsed = null;
    }

    if (!response.ok) {
        const message = parsed?.error?.message || bodyText || `OpenAI request failed with status ${response.status}`;
        throw new Error(message);
    }

    const translatedText = normalizeWhitespace(extractOutputText(parsed));
    if (!translatedText) {
        throw new Error('OpenAI returned an empty translation payload');
    }

    log?.('[translation] translation complete', {
        sourceLanguage,
        model: openAiTranslationModel,
        charsIn: text.length,
        charsOut: translatedText.length,
    });

    return translatedText;
}

async function enrichMetadataWithTranslation(metadata, log = console.log) {
    if (!shouldTranslateMetadata(metadata)) return metadata;

    const cacheKey = buildTranslationCacheKey(metadata);
    if (translationCache.has(cacheKey)) {
        const cached = translationCache.get(cacheKey);
        metadata.translation = cached;
        metadata.translatedText = cached.text;
        return metadata;
    }

    const sourceText = getSourceText(metadata);

    try {
        const translatedText = await translateTextToEnglish({
            text: sourceText,
            sourceLanguage: metadata.lang,
            log,
        });

        if (!translatedText || normalizeWhitespace(translatedText) === normalizeWhitespace(sourceText)) {
            return metadata;
        }

        const translation = {
            provider: 'openai',
            model: openAiTranslationModel,
            sourceLanguage: metadata.lang,
            destinationLanguage: 'en',
            text: translatedText,
        };

        translationCache.set(cacheKey, translation);
        metadata.translation = translation;
        metadata.translatedText = translatedText;
    } catch (err) {
        log?.(`[translation] skipping translation for tweet ${metadata?.tweetID || 'unknown'}: ${err.message}`);
    }

    return metadata;
}

function buildDisplayText(metadata) {
    const sourceText = normalizeWhitespace(getSourceText(metadata));
    const translatedText = normalizeWhitespace(metadata?.translatedText || metadata?.translation?.text);

    if (!translatedText) return sourceText;

    const sourceLanguage = String(
        metadata?.translation?.sourceLanguage || metadata?.lang || 'unknown'
    ).trim().toUpperCase();

    return `${sourceText}\n\n[Translated from ${sourceLanguage}]\n${translatedText}`.trim();
}

module.exports = {
    buildDisplayText,
    enrichMetadataWithTranslation,
    getSourceText,
    isEnglishLanguage,
    shouldTranslateMetadata,
    translateTextToEnglish,
};
