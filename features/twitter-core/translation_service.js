const {
    ollamaGenerateEndpoint,
    ollamaHost,
    ollamaPort,
    ollamaTranslationModel,
} = require('../../config/env_config.js');
const { normalizeTranslation } = require('./fxvx_normalize.js');

const ENGLISH_LANGUAGE_RE = /^en(?:[-_]|$)/i;
const NON_TRANSLATABLE_LANGUAGE_RE = /^(?:zxx|und)(?:[-_]|$)/i;
const URL_ONLY_RE = /https?:\/\/\S+/gi;
const languageDisplayNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'language' })
    : null;
const TWITTER_SPECIAL_LANGUAGE_CODES = new Map(Object.entries({
    qam: {
        displayName: 'mentions only',
        promptDescription: 'mentions only',
        isTranslatable: true,
    },
    qct: {
        displayName: 'cashtags only',
        promptDescription: 'cashtags only',
        isTranslatable: true,
    },
    qht: {
        displayName: 'hashtags only',
        promptDescription: 'hashtags only',
        isTranslatable: true,
    },
    qme: {
        displayName: 'media links',
        promptDescription: 'media links',
        isTranslatable: true,
    },
    qst: {
        displayName: 'very short text',
        promptDescription: 'very short text',
        isTranslatable: true,
    },
    zxx: {
        displayName: 'no linguistic content',
        promptDescription: 'no linguistic content',
        isTranslatable: false,
    },
}));
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

function getTwitterSpecialLanguage(code) {
    const normalized = String(code || '').trim().toLowerCase().replace(/_/g, '-');
    return TWITTER_SPECIAL_LANGUAGE_CODES.get(normalized.split('-')[0]) || null;
}

function isNonTranslatableLanguage(lang) {
    const special = getTwitterSpecialLanguage(lang);
    if (special) return !special.isTranslatable;
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
    const text = getSourceText(metadata);
    if (!text) return false;
    return Boolean(getApiTranslation(metadata));
}

function hasMissingApiTranslation(metadata) {
    if (!metadata || metadata.error) return false;
    if (getApiTranslation(metadata)) return false;
    if (!getSourceText(metadata)) return false;
    if (!metadata.lang || isEnglishLanguage(metadata.lang)) return false;
    if (isNonTranslatableLanguage(metadata.lang)) return false;
    return true;
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

    const special = getTwitterSpecialLanguage(normalized);
    if (special?.displayName) return special.displayName;

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
    const special = getTwitterSpecialLanguage(sourceCode);

    if (special?.isTranslatable) {
        return [
            `You are a professional translator working from X/Twitter posts into ${targetName} (${targetCode}).`,
            `The source post is labeled ${sourceName} (${sourceCode}), which is a Twitter-specific content classification rather than a real language code.`,
            `Infer the actual source language from the text itself and produce only the ${targetName} translation, without any additional explanations or commentary.`,
            '',
            '',
            text,
        ].join('\n');
    }

    return [
        `You are a professional ${sourceName} (${sourceCode}) to ${targetName} (${targetCode}) translator. Your goal is to accurately convey the meaning and nuances of the original ${sourceName} text while adhering to ${targetName} grammar, vocabulary, and cultural sensitivities.`,
        `Produce only the ${targetName} translation, without any additional explanations or commentary. Please translate the following ${sourceName} text into ${targetName}:`,
        '',
        '',
        text,
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

function getApiTranslation(metadata) {
    const translation = normalizeTranslation(metadata?.translation, metadata?.lang);
    if (!translation?.text) return null;
    if (translation.provider === 'ollama') return null;
    return translation;
}

async function translateMetadataBatchToEnglish(items, log = console.log) {
    const list = Array.isArray(items) ? items : [];
    let applied = 0;

    for (const metadata of list) {
        const before = metadata?.translatedText;
        await enrichMetadataWithTranslation(metadata, log);
        if (metadata?.translatedText && metadata.translatedText !== before) applied += 1;
    }

    if (applied > 0) log?.(`[translation] applied API translation for ${applied} item(s)`);
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
    const translation = getApiTranslation(metadata);
    if (!translation) {
        if (hasMissingApiTranslation(metadata)) {
            log?.(`[translation] missing API translation for non-English tweet ${metadata?.tweetID || 'unknown'} (${metadata.lang})`);
        }
        return metadata;
    }

    metadata.translation = translation;
    metadata.translatedText = translation.text;
    log?.(`[translation] applied API translation for tweet ${metadata?.tweetID || 'unknown'}`);

    return metadata;
}

function buildDisplayText(metadata) {
    const sourceText = normalizeWhitespace(getSourceText(metadata));
    const translation = getApiTranslation(metadata);
    const translatedText = normalizeWhitespace(translation?.text);

    if (!sourceText) return '';
    if (!translatedText) return sourceText;

    const sourceLanguageCode = String(
        translation?.sourceLanguage || metadata?.lang || 'unknown'
    ).trim();
    const sourceLanguageName = getLanguageName(sourceLanguageCode);

    return `${sourceText}\n\n[Translated from ${sourceLanguageName}]\n${translatedText}`.trim();
}

module.exports = {
    buildDisplayText,
    buildTranslateGemmaPrompt,
    enrichMetadataWithTranslation,
    translateMetadataBatchToEnglish,
    getSourceText,
    getLanguageName,
    improveEnglishText,
    isEnglishLanguage,
    isLikelyTranslationFailure,
    isNonTranslatableLanguage,
    hasMissingApiTranslation,
    getApiTranslation,
    normalizeWhitespace,
    resolveLanguageCode,
    shouldTranslateMetadata,
    translateText,
    translateTextToEnglish,
};
