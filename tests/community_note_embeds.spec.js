const { buildCommunityNoteEmbeds } = require('../features/twitter-core/webhook_utils.js');
const { normalizeQtMetadata } = require('../features/twitter-post/canvas/metadata_normalize.js');

describe('community note embed rendering', () => {
    test('buildCommunityNoteEmbeds emits main and QT note embeds in order', () => {
        const embeds = buildCommunityNoteEmbeds({}, {
            main: 'Primary post note',
            qt: 'Quote tweet note',
        });

        expect(embeds).toEqual([
            expect.objectContaining({
                title: 'Community Note:',
                description: 'Primary post note',
            }),
            expect.objectContaining({
                title: 'QT Community Note:',
                description: 'Quote tweet note',
            }),
        ]);
    });

    test('normalizeQtMetadata preserves community note text', () => {
        const normalized = normalizeQtMetadata({
            user_screen_name: 'quoted',
            user_name: 'Quoted User',
            user_profile_image_url: 'https://example.com/quoted.jpg',
            text: 'quoted text https://t.co/abcdef',
            communityNote: 'Quoted post context',
            media_extended: [],
        });

        expect(normalized.qtMetadata.communityNote).toBe('Quoted post context');
        expect(normalized.qtMetadata.description).toBe('quoted text');
    });
});
