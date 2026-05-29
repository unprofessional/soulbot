const {
    consumePendingRenderOwnership,
    registerPendingRenderOwnership,
} = require('../features/twitter-core/render_ownership_registry.js');

describe('render ownership registry', () => {
    test('returns ownership metadata once per webhook', () => {
        registerPendingRenderOwnership('wh-1', {
            owningUserId: 'user-1',
            kind: 'twitter_render',
        });

        expect(consumePendingRenderOwnership('wh-1')).toEqual({
            owningUserId: 'user-1',
            kind: 'twitter_render',
        });
        expect(consumePendingRenderOwnership('wh-1')).toBeNull();
    });
});
