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
    const fetchUser = jest.fn().mockResolvedValue({ id: 'user' });
    return {
        guildId: 'guild-1',
        guild: {},
        client: {
            users: {
                fetch: fetchUser,
            },
        },
        fetchUser,
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
        expect(interaction.fetchUser).toHaveBeenCalledWith('user-1', { force: true });
        expect(interaction.fetchUser).toHaveBeenCalledWith('user-2', { force: true });
    });

    test('renders the last known identity for deleted users', async () => {
        mockGetHilariousLeaderboard.mockResolvedValue([
            {
                memberId: 'deleted-user-1',
                total: 43,
                lastKnownUser: {
                    username: 'original_acc_name',
                    globalName: 'DisplayName',
                    displayName: 'DisplayName',
                },
            },
            {
                memberId: 'deleted-user-2',
                total: 38,
                lastKnownUser: {
                    username: 'SecondUser',
                    globalName: null,
                    displayName: 'SecondUser',
                },
            },
        ]);

        const interaction = buildInteraction();
        interaction.fetchUser.mockRejectedValue(new Error('Unknown User'));

        await command.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            'Top <:hilarious:12345> leaderboard\n'
            + '1. `original_acc_name` / DisplayName (deleted acc) - 43\n'
            + '2. `SecondUser` (deleted acc) - 38'
        );
    });
});
