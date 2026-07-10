const mockDeleteTrackedTweetRender = jest.fn();

jest.mock('discord.js', () => ({
    ApplicationCommandType: { Message: 3 },
    ApplicationIntegrationType: { GuildInstall: 0, UserInstall: 1 },
    ContextMenuCommandBuilder: class ContextMenuCommandBuilder {
        constructor() {
            this.contexts = [];
            this.integrationTypes = [];
            this.name = '';
            this.type = null;
        }
        setContexts(...contexts) {
            this.contexts = contexts;
            return this;
        }
        setIntegrationTypes(...integrationTypes) {
            this.integrationTypes = integrationTypes;
            return this;
        }
        setName(name) {
            this.name = name;
            return this;
        }
        setType(type) {
            this.type = type;
            return this;
        }
        toJSON() {
            const json = {
                integration_types: this.integrationTypes,
                name: this.name,
                type: this.type,
            };
            if (this.contexts.length > 0) {
                json.contexts = this.contexts;
            }
            return json;
        }
    },
}));

jest.mock('../commands/utility/delete-tweet-render.js', () => ({
    deleteTrackedTweetRender: mockDeleteTrackedTweetRender,
}));

const command = require('../commands/utility/delete-tweet-render-context.js');

function buildInteraction({
    guildId = 'guild-1',
    channelId = 'channel-1',
    targetMessage = {
        id: 'render-msg-1',
        channelId: 'channel-9',
    },
} = {}) {
    return {
        guildId,
        channelId,
        targetMessage,
        reply: jest.fn(),
    };
}

describe('Delete tweet render message context command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDeleteTrackedTweetRender.mockResolvedValue(undefined);
    });

    test('registers as a message context menu command', () => {
        expect(command.data.toJSON()).toEqual({
            integration_types: [0, 1],
            name: 'Delete tweet render',
            type: 3,
        });
    });

    test('deletes the selected tracked render message', async () => {
        const interaction = buildInteraction();

        await command.execute(interaction);

        expect(mockDeleteTrackedTweetRender).toHaveBeenCalledWith(interaction, {
            parsedTarget: {
                type: 'discord_message',
                guildId: 'guild-1',
                channelId: 'channel-9',
                messageId: 'render-msg-1',
            },
            notFoundMessage: 'That selected message is not a tracked tweet render.',
        });
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('falls back to interaction channel when target message has no channel id', async () => {
        const interaction = buildInteraction({
            targetMessage: {
                id: 'render-msg-1',
            },
        });

        await command.execute(interaction);

        expect(mockDeleteTrackedTweetRender).toHaveBeenCalledWith(interaction, expect.objectContaining({
            parsedTarget: expect.objectContaining({
                channelId: 'channel-1',
            }),
        }));
    });

    test('rejects unresolved selected messages', async () => {
        const interaction = buildInteraction({ targetMessage: null });

        await command.execute(interaction);

        expect(mockDeleteTrackedTweetRender).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'I could not resolve the selected message.',
            ephemeral: true,
        });
    });
});
