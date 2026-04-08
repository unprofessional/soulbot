const {
    normalizeFromFX,
    normalizeFromVX,
    extractCommunityNote,
} = require('../features/twitter-core/fxvx_normalize.js');

describe('fxvx community note normalization', () => {
    test('extractCommunityNote handles direct and nested note shapes', () => {
        expect(extractCommunityNote({ communityNote: '  First note  ' })).toBe('First note');
        expect(extractCommunityNote({ community_note: { text: 'Nested note' } })).toBe('Nested note');
        expect(extractCommunityNote({ birdwatch: { noteText: 'Birdwatch note' } })).toBe('Birdwatch note');
        expect(extractCommunityNote({ community_notes: [{ description: 'Array note' }] })).toBe('Array note');
        expect(extractCommunityNote({})).toBeNull();
    });

    test('normalizeFromVX preserves community note text', () => {
        const normalized = normalizeFromVX({
            tweetID: '123',
            text: 'hello world',
            user_name: 'Example User',
            user_screen_name: 'example',
            user_profile_image_url: 'https://example.com/pfp.jpg',
            media_extended: [],
            communityNote: {
                text: 'This post is missing context.',
            },
        });

        expect(normalized.communityNote).toBe('This post is missing context.');
    });

    test('normalizeFromFX preserves community note text from tweet payloads', () => {
        const normalized = normalizeFromFX({
            message: 'OK',
            code: 200,
            tweet: {
                id: '456',
                text: 'video post',
                created_timestamp: 1710000000,
                author: {
                    name: 'Video User',
                    screen_name: 'videouser',
                    avatar_url: 'https://example.com/avatar.jpg',
                },
                media: {
                    videos: [{
                        url: 'https://video.example.com/video.mp4',
                        thumbnail_url: 'https://video.example.com/thumb.jpg',
                        width: 1280,
                        height: 720,
                        duration: 15,
                        format: 'video/mp4',
                    }],
                },
                community_notes: [{
                    body: 'Added context for the attached video.',
                }],
            },
        });

        expect(normalized.communityNote).toBe('Added context for the attached video.');
        expect(normalized.media_extended).toHaveLength(1);
        expect(normalized.media_extended[0].type).toBe('video');
    });

    test('normalizeFromVX preserves embedded quote tweet metadata including community note', () => {
        const normalized = normalizeFromVX({
            tweetID: '789',
            text: 'Main tweet text',
            user_name: 'Main User',
            user_screen_name: 'mainuser',
            user_profile_image_url: 'https://example.com/main.jpg',
            media_extended: [],
            qrtURL: 'https://twitter.com/i/status/456',
            qrt: {
                tweetID: '456',
                text: 'Quoted tweet text',
                user_name: 'Quoted User',
                user_screen_name: 'quoteduser',
                user_profile_image_url: 'https://example.com/quoted.jpg',
                media_extended: [],
                communityNote: 'Quoted post context from inline payload.',
            },
        });

        expect(normalized.qrtURL).toBe('https://twitter.com/i/status/456');
        expect(normalized.qtMetadata).toEqual(expect.objectContaining({
            tweetID: '456',
            communityNote: 'Quoted post context from inline payload.',
        }));
    });
});
