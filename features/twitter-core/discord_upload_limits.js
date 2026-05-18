const DISCORD_UPLOAD_LIMITS_MB_BY_BOOST_TIER = Object.freeze({
    0: 10,
    1: 10,
    2: 50,
    3: 100,
});

function getDiscordUploadLimitMb(boostTier = 0) {
    return DISCORD_UPLOAD_LIMITS_MB_BY_BOOST_TIER[boostTier] ??
        DISCORD_UPLOAD_LIMITS_MB_BY_BOOST_TIER[0];
}

function getDiscordUploadLimitBytes(boostTier = 0) {
    return getDiscordUploadLimitMb(boostTier) * 1024 * 1024;
}

module.exports = {
    DISCORD_UPLOAD_LIMITS_MB_BY_BOOST_TIER,
    getDiscordUploadLimitBytes,
    getDiscordUploadLimitMb,
};
