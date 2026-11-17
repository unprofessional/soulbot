const { EventEmitter } = require('node:events');
const { Events } = require('discord.js');
jest.mock('../features/counting/service.js', () => ({ handleMessage: jest.fn() }));
jest.mock('../features/role-enforcement/role-enforcement.js', () => ({ enforceGoldyRole: jest.fn(), enforceOwnerProxyRole: jest.fn() }));
jest.mock('../features/translation/auto_speak_english.js', () => ({ handleSpeakEnglishRole: jest.fn() }));
jest.mock('../logger/logger.js', () => ({ logMessage: jest.fn() }));
jest.mock('../features/twitter-core/twitter_handler.js', () => ({ handleTwitterUrl: jest.fn() }));
jest.mock('../features/reactions/hilarious_reacts.js', () => ({ handleHilariousReactionAdd: jest.fn() }));
jest.mock('../store/services/messages.service.js', () => ({ updateMessage: jest.fn(), deleteMessage: jest.fn() }));
jest.mock('../store/features.js', () => ({ getFeature: jest.fn() }));
jest.mock('../app/lifecycle.js', () => ({ shouldAcceptWork: () => true }));
const { initializeListeners } = require('../message_listeners/core.js');
const { handleMessage } = require('../features/counting/service.js');
const { logMessage } = require('../logger/logger.js');
const { enforceOwnerProxyRole, enforceGoldyRole } = require('../features/role-enforcement/role-enforcement.js');
const { handleSpeakEnglishRole } = require('../features/translation/auto_speak_english.js');
let handler;
beforeEach(async () => {
    jest.clearAllMocks();
    const client = new EventEmitter();
    await initializeListeners(client);
    handler = client.listeners(Events.MessageCreate)[0];
});
test('counting messages bypass logging and unrelated transformations', async () => {
    handleMessage.mockResolvedValue(true);
    await handler({ guildId: 'g', author: { id: 'u', bot: false } });
    expect(logMessage).not.toHaveBeenCalled();
    expect(enforceOwnerProxyRole).not.toHaveBeenCalled();
    expect(enforceGoldyRole).not.toHaveBeenCalled();
    expect(handleSpeakEnglishRole).not.toHaveBeenCalled();
});
test('unconfigured channels retain logging and transformations', async () => {
    handleMessage.mockResolvedValue(false);
    await handler({ guildId: 'g', author: { id: 'u', bot: false } });
    expect(logMessage).toHaveBeenCalledTimes(1);
    expect(enforceGoldyRole).toHaveBeenCalledTimes(1);
    expect(handleSpeakEnglishRole).toHaveBeenCalledTimes(1);
});
