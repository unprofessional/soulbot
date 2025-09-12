// features/twitter-core/fxvx_normalize.js
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
        qrtURL: t.quote?.url ?? undefined,
        _fx_message: fx.message, // e.g., OK / PRIVATE_TWEET / NOT_FOUND
        _fx_code: fx.code,
    };
}

module.exports = { normalizeFromVX, normalizeFromFX };
