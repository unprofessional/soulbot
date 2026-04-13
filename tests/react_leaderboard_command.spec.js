const mockGetHilariousLeaderboard = jest.fn();

jest.mock('discord.js', () => ({
    SlashCommandBuilder: class SlashCommandBuilder {
        setName() { return this; }
        setDescription() { return this; }
        setDMPermission() { return this; }
    },
}));

jest.mock('../features/reactions/hilarious_reacts.js', () => ({
    getHilariousEmojiDisplay: jest.fn(() => '<:hilarious:12345>'),
    getHilariousLeaderboard: mockGetHilariousLeaderboard,
}));

const command = require('../commands/utility/react-leaderboard.js');

function buildInteraction() {
    return {
        guildId: 'guild-1',
        guild: {},
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
    };
}

describe('/react-leaderboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetHilariousLeaderboard.mockResolvedValue([]);
    });

    test('shows an empty-state message when no one has any hilarious reacts', async () => {
        const interaction = buildInteraction();

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(mockGetHilariousLeaderboard).toHaveBeenCalledWith('guild-1', 10);
        expect(interaction.editReply).toHaveBeenCalledWith(
            'No one has received any <:hilarious:12345> reacts yet.'
        );
    });

    test('renders the top 10 hilarious react leaderboard', async () => {
        mockGetHilariousLeaderboard.mockResolvedValue([
            { memberId: 'user-1', total: 50 },
            { memberId: 'user-2', total: 25 },
        ]);

        const interaction = buildInteraction();
        await command.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            'Top <:hilarious:12345> leaderboard\n1. <@user-1> - 50\n2. <@user-2> - 25'
        );
    });
});
