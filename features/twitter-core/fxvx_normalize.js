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

function normalizeFromVX(vx) {
    return {
        tweetID: vx.tweetID,
        replyingToID: vx.replyingToID ?? vx.replying_to_status ?? null,
        text: vx.text ?? '',
        user_name: vx.user_name ?? 'Unknown',
        user_screen_name: vx.user_screen_name ?? 'unknown',
        user_profile_image_url: vx.user_profile_image_url ?? '',
        date_epoch: vx.date_epoch ?? Math.floor(Date.now() / 1000),
        hasMedia: Boolean(vx.media_extended?.length),
        media_extended: vx.media_extended ?? [],
        communityNote: extractCommunityNote(vx),
        qrtURL: vx.qrtURL ?? undefined,
    };
}

function normalizeFromFX(fx) {
    const t = fx?.tweet;
    if (!t) return null;
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
        text: t.text ?? '',
        user_name: t.author?.name ?? 'Unknown',
        user_screen_name: t.author?.screen_name ?? 'unknown',
        user_profile_image_url: t.author?.avatar_url ?? '',
        date_epoch: t.created_timestamp ?? Math.floor(Date.now() / 1000),
        hasMedia: Boolean(media.length),
        media_extended: media,
        communityNote: extractCommunityNote(fx, t),
        qrtURL: t.quote?.url ?? undefined,
        _fx_message: fx.message, // e.g., OK / PRIVATE_TWEET / NOT_FOUND
        _fx_code: fx.code,
    };
}

module.exports = { normalizeFromVX, normalizeFromFX, extractCommunityNote };
