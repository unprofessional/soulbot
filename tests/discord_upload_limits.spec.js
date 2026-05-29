const {
    DISCORD_UPLOAD_LIMITS_MB_BY_BOOST_TIER,
    getDiscordUploadLimitBytes,
    getDiscordUploadLimitMb,
} = require('../features/twitter-core/discord_upload_limits.js');

describe('discord upload limits', () => {
    test('maps server boost tiers to current upload limits', () => {
        expect(DISCORD_UPLOAD_LIMITS_MB_BY_BOOST_TIER).toEqual({
            0: 10,
            1: 10,
            2: 50,
            3: 100,
        });
    });

    test('returns megabytes and bytes with base tier fallback', () => {
        expect(getDiscordUploadLimitMb(2)).toBe(50);
        expect(getDiscordUploadLimitBytes(2)).toBe(50 * 1024 * 1024);
        expect(getDiscordUploadLimitMb(999)).toBe(10);
    });
});
