// features/twitter-core/fxvx_normalize.js
function firstNonEmptyString(values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}

function extractNoteText(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.trim() || null;
    if (Array.isArray(value)) {
        for (const entry of value) {
            const text = extractNoteText(entry);
            if (text) return text;
        }
        return null;
    }
    if (typeof value !== 'object') return null;

    return firstNonEmptyString([
        value.text,
        value.noteText,
        value.description,
        value.body,
        value.content,
        value.summary,
    ]);
}

function extractCommunityNote(...sources) {
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;

        const direct = firstNonEmptyString([
            source.communityNote,
            source.community_note,
            source.communityNotes,
            source.community_notes,
            source.birdwatch_note,
        ]);
        if (direct) return direct;

        const nested = [
            source.communityNote,
            source.community_note,
            source.communityNotes,
            source.community_notes,
            source.birdwatch,
            source.birdwatch_note,
            source.note,
        ];

        for (const candidate of nested) {
            const text = extractNoteText(candidate);
            if (text) return text;
        }
    }

    return null;
}

function normalizeEmbeddedQuoteTweet(rawQuote) {
    if (!rawQuote || typeof rawQuote !== 'object') return undefined;

    if (rawQuote.tweetID || rawQuote.user_name) {
        return normalizeFromVX(rawQuote);
    }

    if (rawQuote.id || rawQuote.author || rawQuote.text) {
        return normalizeFromFX({
            tweet: rawQuote,
            message: 'OK',
            code: 200,
            lang: rawQuote.lang ?? null,
        });
    }

    return undefined;
}

function normalizeArticle(rawArticle) {
    if (!rawArticle || typeof rawArticle !== 'object') return null;

    const article = {
        title: firstNonEmptyString([
            rawArticle.title,
            rawArticle.name,
            rawArticle.headline,
        ]),
        preview_text: firstNonEmptyString([
            rawArticle.preview_text,
            rawArticle.previewText,
            rawArticle.description,
            rawArticle.summary,
            rawArticle.subtitle,
        ]),
        text: firstNonEmptyString([
            rawArticle.text,
            rawArticle.body,
            rawArticle.content,
            rawArticle.article_text,
            rawArticle.articleText,
        ]),
        image: firstNonEmptyString([
            rawArticle.image,
            rawArticle.image_url,
            rawArticle.imageUrl,
            rawArticle.thumbnail_url,
            rawArticle.thumbnailUrl,
        ]),
        url: firstNonEmptyString([
            rawArticle.url,
            rawArticle.article_url,
            rawArticle.articleUrl,
        ]),
    };

    return Object.fromEntries(
        Object.entries(article).filter(([, value]) => value)
    );
}

function normalizeTranslation(rawTranslation, sourceLanguage) {
    if (!rawTranslation) return null;

    if (typeof rawTranslation === 'string') {
        const text = rawTranslation.trim();
        if (!text) return null;
        return {
            provider: 'api',
            sourceLanguage: sourceLanguage ?? null,
            destinationLanguage: 'en',
            text,
        };
    }

    if (typeof rawTranslation !== 'object') return null;

    const text = firstNonEmptyString([
        rawTranslation.text,
        rawTranslation.translation,
        rawTranslation.translatedText,
        rawTranslation.translated_text,
        rawTranslation.full_text,
    ]);

    if (!text) return null;

    return {
        provider: rawTranslation.provider || rawTranslation.service || 'api',
        model: rawTranslation.model,
        sourceLanguage: firstNonEmptyString([
            rawTranslation.sourceLanguage,
            rawTranslation.source_language,
            rawTranslation.sourceLang,
            rawTranslation.source_lang,
            sourceLanguage,
        ]),
        destinationLanguage: firstNonEmptyString([
            rawTranslation.destinationLanguage,
            rawTranslation.destination_language,
            rawTranslation.targetLanguage,
            rawTranslation.target_language,
            rawTranslation.targetLang,
            rawTranslation.target_lang,
            rawTranslation.lang,
        ]) || 'en',
        text,
    };
}

function normalizeFromVX(vx) {
    const translation = normalizeTranslation(vx.translation, vx.lang);

    return {
        tweetID: vx.tweetID,
        replyingToID: vx.replyingToID ?? vx.replying_to_status ?? null,
        lang: vx.lang ?? null,
        text: vx.text ?? '',
        translation,
        translatedText: translation?.text,
        user_name: vx.user_name ?? 'Unknown',
        user_screen_name: vx.user_screen_name ?? 'unknown',
        user_profile_image_url: vx.user_profile_image_url ?? '',
        date_epoch: vx.date_epoch ?? Math.floor(Date.now() / 1000),
        hasMedia: Boolean(vx.media_extended?.length),
        media_extended: vx.media_extended ?? [],
        article: normalizeArticle(vx.article),
        communityNote: extractCommunityNote(vx),
        qtMetadata: normalizeEmbeddedQuoteTweet(vx.qrt),
        qrtURL: vx.qrtURL ?? undefined,
    };
}

function normalizeFromFX(fx) {
    const t = fx?.tweet;
    if (!t) return null;
    const translation = normalizeTranslation(t.translation ?? fx.translation, t.lang ?? fx?.lang);
    const media = [];
    if (t.media?.photos) {
        for (const p of t.media.photos) {
            media.push({
                type: 'image',
                url: p.url,
                thumbnail_url: p.url,
                altText: p.altText ?? null,
                size: { width: p.width, height: p.height },
            });
        }
    }
    if (t.media?.videos) {
        for (const v of t.media.videos) {
            media.push({
                type: v.type === 'gif' ? 'video' : 'video',
                url: v.url,
                thumbnail_url: v.thumbnail_url,
                duration_millis: Math.round((v.duration ?? 0) * 1000),
                size: { width: v.width, height: v.height },
                format: v.format,
            });
        }
    }
    return {
        tweetID: t.id,
        replyingToID: t.replying_to_status ?? null,
        lang: t.lang ?? fx?.lang ?? null,
        text: t.text ?? '',
        translation,
        translatedText: translation?.text,
        user_name: t.author?.name ?? 'Unknown',
        user_screen_name: t.author?.screen_name ?? 'unknown',
        user_profile_image_url: t.author?.avatar_url ?? '',
        date_epoch: t.created_timestamp ?? Math.floor(Date.now() / 1000),
        hasMedia: Boolean(media.length),
        media_extended: media,
        article: normalizeArticle(t.article ?? fx.article ?? t.card),
        communityNote: extractCommunityNote(fx, t),
        qtMetadata: normalizeEmbeddedQuoteTweet(t.quote ?? fx.quote),
        qrtURL: t.quote?.url ?? undefined,
        _fx_message: fx.message, // e.g., OK / PRIVATE_TWEET / NOT_FOUND
        _fx_code: fx.code,
    };
}

module.exports = { normalizeFromVX, normalizeFromFX, extractCommunityNote, normalizeEmbeddedQuoteTweet, normalizeArticle, normalizeTranslation };
