const { EventEmitter } = require('events');
const { Events } = require('discord.js');

const mockDeleteMessage = jest.fn();

jest.mock('../features/role-enforcement/role-enforcement.js', () => ({
    enforceGoldyRole: jest.fn(),
    enforceOwnerProxyRole: jest.fn(),
}));

jest.mock('../features/translation/auto_speak_english.js', () => ({
    handleSpeakEnglishRole: jest.fn(),
}));

jest.mock('../logger/logger.js', () => ({
    logMessage: jest.fn(),
}));

jest.mock('../features/twitter-core/twitter_handler.js', () => ({
    handleTwitterUrl: jest.fn(),
}));

jest.mock('../features/reactions/hilarious_reacts.js', () => ({
    handleHilariousReactionAdd: jest.fn(),
}));

jest.mock('../store/services/messages.service.js', () => ({
    updateMessage: jest.fn(),
    deleteMessage: mockDeleteMessage,
}));

jest.mock('../store/features.js', () => ({
    getFeature: jest.fn(),
}));

jest.mock('../config/env_config.js', () => ({
    soulbotUserId: 'soulbot-user',
}));

jest.mock('../app/lifecycle.js', () => ({
    shouldAcceptWork: jest.fn(() => true),
}));

const { initializeListeners } = require('../message_listeners/core.js');

describe('message listener deletion handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('marks partial deleted messages as deleted by id', async () => {
        const client = new EventEmitter();

        await initializeListeners(client);
        client.emit(Events.MessageDelete, {
            id: 'deleted-message-1',
            partial: true,
        });

        await new Promise(resolve => setImmediate(resolve));

        expect(mockDeleteMessage).toHaveBeenCalledWith('deleted-message-1');
    });
});
