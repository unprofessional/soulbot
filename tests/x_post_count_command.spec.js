const mockCountSuccessfulTwitterRendersByUser = jest.fn();

jest.mock('discord.js', () => ({
    SlashCommandBuilder: class SlashCommandBuilder {
        setName() { return this; }
        setDescription() { return this; }
        setDMPermission() { return this; }
        addUserOption(callback) {
            callback({
                setName() { return this; },
                setDescription() { return this; },
                setRequired() { return this; },
            });
            return this;
        }
        addStringOption(callback) {
            callback({
                setName() { return this; },
                setDescription() { return this; },
                setRequired() { return this; },
                addChoices() { return this; },
            });
            return this;
        }
    },
}));

jest.mock('../store/services/messages.service.js', () => ({
    countSuccessfulTwitterRendersByUser: mockCountSuccessfulTwitterRendersByUser,
}));

const command = require('../commands/utility/x-post-count.js');

function buildInteraction({ selectedUser = null, period = null } = {}) {
    return {
        user: { id: 'caller-1' },
        options: {
            getUser: jest.fn().mockReturnValue(selectedUser),
            getString: jest.fn().mockReturnValue(period),
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
    };
}

describe('/x-post-count', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-12T12:00:00.000Z'));
        mockCountSuccessfulTwitterRendersByUser.mockResolvedValue(0);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('defaults to the caller and the rolling past 24 hours', async () => {
        const interaction = buildInteraction();

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(mockCountSuccessfulTwitterRendersByUser).toHaveBeenCalledWith({
            userId: 'caller-1',
            createdSince: new Date('2026-08-11T12:00:00.000Z'),
        });
        expect(interaction.editReply).toHaveBeenCalledWith({
            content: '<@caller-1> had 0 X posts rendered by Soulbot in the past 24 hours.',
            allowedMentions: { parse: [] },
        });
    });

    test.each([
        ['5d', '2026-08-07T12:00:00.000Z', 'past 5 days'],
        ['7d', '2026-08-05T12:00:00.000Z', 'past 7 days'],
    ])('counts a selected user over %s', async (period, cutoff, label) => {
        mockCountSuccessfulTwitterRendersByUser.mockResolvedValue(1);
        const interaction = buildInteraction({
            selectedUser: { id: 'selected-1' },
            period,
        });

        await command.execute(interaction);

        expect(mockCountSuccessfulTwitterRendersByUser).toHaveBeenCalledWith({
            userId: 'selected-1',
            createdSince: new Date(cutoff),
        });
        expect(interaction.editReply).toHaveBeenCalledWith({
            content: `<@selected-1> had 1 X post rendered by Soulbot in the ${label}.`,
            allowedMentions: { parse: [] },
        });
    });
});
