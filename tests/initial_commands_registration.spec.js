const { registerMessageContextCommandsForGuilds } = require('../initial_commands.js');

describe('initial command registration helpers', () => {
    let logSpy;
    let tableSpy;
    let errorSpy;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        tableSpy = jest.spyOn(console, 'table').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        tableSpy.mockRestore();
        errorSpy.mockRestore();
        jest.restoreAllMocks();
    });

    test('upserts message context commands into every guild without global-only fields', async () => {
        const rest = {
            post: jest.fn(async (_route, { body }) => ({
                id: `registered-${body.name}`,
                name: body.name,
                type: body.type,
            })),
            get: jest.fn(async () => [
                { id: 'ctx-1', name: 'Delete tweet render', type: 3 },
                { id: 'slash-1', name: 'summary', type: 1 },
            ]),
        };
        const client = {
            guilds: {
                cache: new Map([
                    ['guild-1', { id: 'guild-1' }],
                    ['guild-2', { id: 'guild-2' }],
                ]),
            },
        };

        await registerMessageContextCommandsForGuilds({
            client,
            rest,
            discordClientId: 'app-1',
            commands: [
                {
                    contexts: [0],
                    integration_types: [0, 1],
                    name: 'Delete tweet render',
                    type: 3,
                },
                {
                    name: 'summary',
                    type: 1,
                },
            ],
        });

        expect(rest.post).toHaveBeenCalledTimes(2);
        expect(rest.post).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('/applications/app-1/guilds/guild-1/commands'),
            {
                body: {
                    name: 'Delete tweet render',
                    type: 3,
                },
            },
        );
        expect(rest.post).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('/applications/app-1/guilds/guild-2/commands'),
            {
                body: {
                    name: 'Delete tweet render',
                    type: 3,
                },
            },
        );
        expect(rest.get).toHaveBeenCalledTimes(2);
    });
});
