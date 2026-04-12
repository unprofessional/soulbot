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
const LANGUAGE_NAME_TO_CODE = new Map(Object.entries({
    afrikaans: 'af',
    albanian: 'sq',
    amharic: 'am',
    arabic: 'ar',
    armenian: 'hy',
    azerbaijani: 'az',
    basque: 'eu',
    belarusian: 'be',
    bengali: 'bn',
    bosnian: 'bs',
    bulgarian: 'bg',
    burmese: 'my',
    catalan: 'ca',
    chinese: 'zh',
    'chinese simplified': 'zh-Hans',
    simplifiedchinese: 'zh-Hans',
    mandarin: 'zh',
    cantonese: 'zh-Hant',
    'chinese traditional': 'zh-Hant',
    traditionalchinese: 'zh-Hant',
    croatian: 'hr',
    czech: 'cs',
    danish: 'da',
    dutch: 'nl',
    english: 'en',
    estonian: 'et',
    filipino: 'fil-PH',
    finnish: 'fi',
    french: 'fr',
    galician: 'gl',
    georgian: 'ka',
    german: 'de',
    greek: 'el',
    gujarati: 'gu',
    haitian: 'ht',
    hebrew: 'he',
    hindi: 'hi',
    hungarian: 'hu',
    icelandic: 'is',
    indonesian: 'id',
    irish: 'ga',
    italian: 'it',
    japanese: 'ja',
    kannada: 'kn',
    kazakh: 'kk',
    korean: 'ko',
    kurdish: 'ku',
    lao: 'lo',
    latin: 'la',
    latvian: 'lv',
    lithuanian: 'lt',
    macedonian: 'mk',
    malay: 'ms',
    malayalam: 'ml',
    maltese: 'mt',
    maori: 'mi',
    marathi: 'mr',
    mongolian: 'mn',
    nepali: 'ne',
    norwegian: 'no',
    norwegianbokmal: 'nb',
    norwegiannynorsk: 'nn',
    persian: 'fa',
    polish: 'pl',
    portuguese: 'pt',
    punjabi: 'pa',
    romanian: 'ro',
    russian: 'ru',
    serbian: 'sr',
    sinhala: 'si',
    slovak: 'sk',
    slovenian: 'sl',
    somali: 'so',
    spanish: 'es',
    swahili: 'sw',
    swedish: 'sv',
    tagalog: 'tl',
    tamil: 'ta',
    telugu: 'te',
    thai: 'th',
    turkish: 'tr',
    ukrainian: 'uk',
    urdu: 'ur',
    uzbek: 'uz',
    vietnamese: 'vi',
    welsh: 'cy',
    yiddish: 'yi',
    yoruba: 'yo',
    zulu: 'zu',
}));

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

function normalizeLanguageLookupKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[()]/g, ' ')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function resolveLanguageCode(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;

    const directCode = raw.replace(/_/g, '-');
    if (/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/i.test(directCode)) return directCode;

    const lookupKey = normalizeLanguageLookupKey(raw);
    if (LANGUAGE_NAME_TO_CODE.has(lookupKey)) return LANGUAGE_NAME_TO_CODE.get(lookupKey);

    const compactKey = lookupKey.replace(/\s+/g, '');
    if (LANGUAGE_NAME_TO_CODE.has(compactKey)) return LANGUAGE_NAME_TO_CODE.get(compactKey);

    return null;
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

function buildBatchTranslateGemmaPrompt(items, { targetLanguage = 'en' } = {}) {
    const targetCode = String(targetLanguage || 'en').trim() || 'en';
    const targetName = getLanguageName(targetCode);

    const serializedItems = items.map(item => ({
        id: String(item.id),
        source_language: String(item.sourceLanguage || 'auto'),
        source_language_name: getLanguageName(item.sourceLanguage || 'auto'),
        text: item.text,
    }));

    return [
        `You are a professional multilingual translator. Translate each item into ${targetName} (${targetCode}).`,
        'Return only valid JSON as an array of objects in this exact shape:',
        '[{"id":"...", "translation":"..."}]',
        'Do not add commentary, markdown, or explanations.',
        'Preserve meaning, tone, slang, line breaks, @mentions, hashtags, emojis, and proper nouns.',
        '',
        JSON.stringify(serializedItems),
    ].join('\n');
}

async function translateText({
    text,
    sourceLanguage,
    targetLanguage = 'en',
    log = console.log,
}) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaGenerateEndpoint}`;
    const prompt = buildTranslateGemmaPrompt({ text, sourceLanguage, targetLanguage });
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
        targetLanguage,
        model: ollamaTranslationModel,
        charsIn: text.length,
        charsOut: translatedText.length,
    });

    return translatedText;
}

function extractJsonArray(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) return null;

    try {
        const parsed = JSON.parse(normalized);
        return Array.isArray(parsed) ? parsed : null;
    } catch {}

    const match = normalized.match(/\[[\s\S]*\]/);
    if (!match) return null;

    try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

async function translateMetadataBatchToEnglish(items, log = console.log) {
    const eligible = (Array.isArray(items) ? items : []).filter(shouldTranslateMetadata);
    if (eligible.length === 0) return items;

    const uncached = [];
    for (const metadata of eligible) {
        const cacheKey = buildTranslationCacheKey(metadata);
        if (translationCache.has(cacheKey)) {
            const cached = translationCache.get(cacheKey);
            metadata.translation = cached;
            metadata.translatedText = cached.text;
        } else {
            uncached.push({
                id: metadata.tweetID || String(uncached.length),
                metadata,
                cacheKey,
                sourceLanguage: metadata.lang,
                text: getSourceText(metadata),
            });
        }
    }

    if (uncached.length === 0) return items;

    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaGenerateEndpoint}`;
    const prompt = buildBatchTranslateGemmaPrompt(uncached, { targetLanguage: 'en' });
    const payload = {
        model: ollamaTranslationModel,
        prompt,
        stream: false,
        keep_alive: -1,
        options: {
            temperature: 0,
        },
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const parsed = await response.json();
        if (!response.ok) {
            const message = parsed?.error || parsed?.message || `Ollama batch request failed with status ${response.status}`;
            throw new Error(message);
        }

        const responseText = normalizeWhitespace(extractOutputText(parsed));
        if (!responseText) throw new Error('Ollama returned an empty batch translation payload');
        if (isLikelyTranslationFailure(responseText)) {
            throw new Error('Ollama returned a batch translation refusal or non-translation response');
        }

        const translatedItems = extractJsonArray(responseText);
        if (!translatedItems) throw new Error('Ollama batch translation response was not valid JSON');

        const translatedById = new Map(
            translatedItems
                .filter(item => item && typeof item.id !== 'undefined')
                .map(item => [String(item.id), normalizeWhitespace(item.translation)])
        );

        for (const item of uncached) {
            const translatedText = translatedById.get(String(item.id));
            if (!translatedText) continue;
            if (normalizeWhitespace(translatedText) === normalizeWhitespace(item.text)) continue;
            if (isLikelyTranslationFailure(translatedText)) continue;

            const translation = {
                provider: 'ollama',
                model: ollamaTranslationModel,
                sourceLanguage: item.sourceLanguage,
                destinationLanguage: 'en',
                text: translatedText,
            };

            translationCache.set(item.cacheKey, translation);
            item.metadata.translation = translation;
            item.metadata.translatedText = translatedText;
        }

        log?.(`[translation] batch translation complete for ${uncached.length} item(s)`);
    } catch (err) {
        log?.(`[translation] batch translation failed, falling back to per-item translation: ${err.message}`);
        for (const item of uncached) {
            await enrichMetadataWithTranslation(item.metadata, log);
        }
    }

    return items;
}

async function translateTextToEnglish({ text, sourceLanguage, log = console.log }) {
    return translateText({
        text,
        sourceLanguage,
        targetLanguage: 'en',
        log,
    });
}

async function improveEnglishText({ text, log = console.log }) {
    return translateText({
        text,
        sourceLanguage: 'en',
        targetLanguage: 'en',
        log,
    });
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

    const sourceLanguageCode = String(
        metadata?.translation?.sourceLanguage || metadata?.lang || 'unknown'
    ).trim();
    const sourceLanguageName = getLanguageName(sourceLanguageCode);

    return `${sourceText}\n\n[Translated from ${sourceLanguageName}]\n${translatedText}`.trim();
}

module.exports = {
    buildDisplayText,
    buildBatchTranslateGemmaPrompt,
    buildTranslateGemmaPrompt,
    enrichMetadataWithTranslation,
    translateMetadataBatchToEnglish,
    getSourceText,
    getLanguageName,
    improveEnglishText,
    isEnglishLanguage,
    isLikelyTranslationFailure,
    isNonTranslatableLanguage,
    normalizeWhitespace,
    resolveLanguageCode,
    shouldTranslateMetadata,
    translateText,
    translateTextToEnglish,
};
