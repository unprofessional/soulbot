const {
    ollamaGenerateEndpoint,
    ollamaHost,
    ollamaPort,
    ollamaTranslationModel,
} = require('../../config/env_config.js');

const ENGLISH_LANGUAGE_RE = /^en(?:[-_]|$)/i;
const NON_TRANSLATABLE_LANGUAGE_RE = /^(?:zxx|und)(?:[-_]|$)/i;
const URL_ONLY_RE = /https?:\/\/\S+/gi;
const translationCache = new Map();
const languageDisplayNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'language' })
    : null;

function getRawSourceText(metadata) {
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

function isNonTranslatableLanguage(lang) {
    return typeof lang === 'string' && NON_TRANSLATABLE_LANGUAGE_RE.test(lang.trim());
}

function getSourceText(metadata) {
    return normalizeWhitespace(
        getRawSourceText(metadata)
            .replace(URL_ONLY_RE, ' ')
    );
}

function isLikelyTranslationFailure(text) {
    const normalized = normalizeWhitespace(text).toLowerCase();
    if (!normalized) return true;

    return [
        'i am unable to access external urls',
        'i cannot access external urls',
        'including the one provided',
        'please provide the text you would like me to translate',
        'cannot translate the content',
    ].some(fragment => normalized.includes(fragment));
}

function shouldTranslateMetadata(metadata) {
    if (!metadata || metadata.error) return false;
    if (metadata.translation?.text || metadata.translatedText) return false;

    const text = getSourceText(metadata);
    if (!text) return false;
    if (isNonTranslatableLanguage(metadata.lang)) return false;

    return Boolean(metadata.lang) && !isEnglishLanguage(metadata.lang);
}

function buildTranslationCacheKey(metadata) {
    const text = getSourceText(metadata);
    return [metadata?.tweetID || '', metadata?.lang || '', text].join('::');
}

function extractOutputText(payload) {
    return typeof payload?.response === 'string' ? payload.response.trim() : '';
}

function fallbackLanguageName(code) {
    const normalized = String(code || 'unknown').trim();
    if (!normalized) return 'Unknown';

    return normalized
        .split('-')[0]
        .replace(/_/g, '-')
        .replace(/^[a-z]/i, c => c.toUpperCase());
}

function getLanguageName(code) {
    const normalized = String(code || '').trim();
    if (!normalized) return 'Unknown';

    const candidates = [
        normalized,
        normalized.replace(/_/g, '-'),
        normalized.replace(/_/g, '-').split('-')[0],
    ];

    for (const candidate of candidates) {
        try {
            const name = languageDisplayNames?.of(candidate);
            if (typeof name === 'string' && name.trim()) return name.trim();
        } catch {}
    }

    return fallbackLanguageName(normalized);
}

function buildTranslateGemmaPrompt({ text, sourceLanguage, targetLanguage = 'en' }) {
    const sourceCode = String(sourceLanguage || 'auto').trim() || 'auto';
    const targetCode = String(targetLanguage || 'en').trim() || 'en';
    const sourceName = getLanguageName(sourceCode);
    const targetName = getLanguageName(targetCode);

    return [
        `You are a professional ${sourceName} (${sourceCode}) to ${targetName} (${targetCode}) translator. Your goal is to accurately convey the meaning and nuances of the original ${sourceName} text while adhering to ${targetName} grammar, vocabulary, and cultural sensitivities.`,
        `Produce only the ${targetName} translation, without any additional explanations or commentary. Please translate the following ${sourceName} text into ${targetName}:`,
        '',
        '',
        text,
    ].join('\n');
}

async function translateTextToEnglish({ text, sourceLanguage, log = console.log }) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaGenerateEndpoint}`;
    const prompt = buildTranslateGemmaPrompt({ text, sourceLanguage, targetLanguage: 'en' });
    const payload = {
        model: ollamaTranslationModel,
        prompt,
        stream: false,
        keep_alive: -1,
        options: {
            temperature: 0,
        },
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const parsed = await response.json();

    if (!response.ok) {
        const message = parsed?.error || parsed?.message || `Ollama request failed with status ${response.status}`;
        throw new Error(message);
    }

    const translatedText = normalizeWhitespace(extractOutputText(parsed));
    if (!translatedText) {
        throw new Error('Ollama returned an empty translation payload');
    }
    if (isLikelyTranslationFailure(translatedText)) {
        throw new Error('Ollama returned a translation refusal or non-translation response');
    }

    log?.('[translation] translation complete', {
        sourceLanguage,
        model: ollamaTranslationModel,
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
            provider: 'ollama',
            model: ollamaTranslationModel,
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

    if (!sourceText) return '';
    if (!translatedText) return sourceText;

    const sourceLanguage = String(
        metadata?.translation?.sourceLanguage || metadata?.lang || 'unknown'
    ).trim().toUpperCase();

    return `${sourceText}\n\n[Translated from ${sourceLanguage}]\n${translatedText}`.trim();
}

module.exports = {
    buildDisplayText,
    buildTranslateGemmaPrompt,
    enrichMetadataWithTranslation,
    getSourceText,
    getLanguageName,
    isEnglishLanguage,
    isLikelyTranslationFailure,
    isNonTranslatableLanguage,
    shouldTranslateMetadata,
    translateTextToEnglish,
};
