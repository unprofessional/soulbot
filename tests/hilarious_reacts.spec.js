const mockGetAllMemberRecords = jest.fn();
const mockGetMemberRecord = jest.fn();
const mockUpsertMemberRecord = jest.fn();
const mockGetMessageById = jest.fn();
const mockFetchUser = jest.fn();

jest.mock('../store/members.js', () => ({
    getAllMemberRecords: mockGetAllMemberRecords,
    getMemberRecord: mockGetMemberRecord,
    upsertMemberRecord: mockUpsertMemberRecord,
}));

jest.mock('../store/services/messages.service.js', () => ({
    getMessageById: mockGetMessageById,
}));

const {
    getHilariousLeaderboard,
    handleHilariousReactionAdd,
    recordHilariousReaction,
} = require('../features/reactions/hilarious_reacts.js');

describe('hilarious reacts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAllMemberRecords.mockResolvedValue([]);
        mockGetMemberRecord.mockResolvedValue(null);
        mockUpsertMemberRecord.mockResolvedValue(null);
        mockGetMessageById.mockResolvedValue(null);
        mockFetchUser.mockResolvedValue(null);
    });

    test('records a first hilarious reaction and announces a milestone at 25', async () => {
        mockGetMemberRecord.mockResolvedValue({
            memberId: 'author-1',
            prefix: null,
            meta: {
                guildMetrics: {
                    'guild-1': {
                        hilariousReacts: {
                            receivedCount: 24,
                            reactedBy: {
                                'reactor-0': ['message-0'],
                            },
                            milestonesAnnounced: [],
                        },
                    },
                },
            },
        });

        const result = await recordHilariousReaction({
            guildId: 'guild-1',
            recipientUser: {
                id: 'author-1',
                username: 'Author',
            },
            reactorId: 'reactor-1',
            messageId: 'message-1',
        });

        expect(result).toEqual({
            counted: true,
            total: 25,
            milestoneReached: true,
            displayName: 'Author',
        });
        expect(mockUpsertMemberRecord).toHaveBeenCalledWith({
            memberId: 'author-1',
            prefix: null,
            meta: {
                guildMetrics: {
                    'guild-1': {
                        hilariousReacts: {
                            receivedCount: 25,
                            reactedBy: {
                                'reactor-0': ['message-0'],
                                'reactor-1': ['message-1'],
                            },
                            milestonesAnnounced: [25],
                        },
                    },
                },
            },
        });
    });

    test('does not count a removed and re-added hilarious reaction on the same message', async () => {
        mockGetMemberRecord.mockResolvedValue({
            memberId: 'author-1',
            prefix: null,
            meta: {
                guildMetrics: {
                    'guild-1': {
                        hilariousReacts: {
                            receivedCount: 5,
                            reactedBy: {
                                'reactor-1': ['message-1'],
                            },
                            milestonesAnnounced: [],
                        },
                    },
                },
            },
        });

        const result = await recordHilariousReaction({
            guildId: 'guild-1',
            recipientUser: {
                id: 'author-1',
                username: 'Author',
            },
            reactorId: 'reactor-1',
            messageId: 'message-1',
        });

        expect(result).toEqual({
            counted: false,
            reason: 'already_counted',
            total: 5,
        });
        expect(mockUpsertMemberRecord).not.toHaveBeenCalled();
    });

    test('sorts the hilarious leaderboard by current guild tally', async () => {
        mockGetAllMemberRecords.mockResolvedValue([
            {
                memberId: 'member-3',
                meta: {
                    guildMetrics: {
                        'guild-1': {
                            hilariousReacts: {
                                receivedCount: 10,
                            },
                        },
                    },
                },
            },
            {
                memberId: 'member-1',
                meta: {
                    guildMetrics: {
                        'guild-1': {
                            hilariousReacts: {
                                receivedCount: 30,
                            },
                        },
                    },
                },
            },
            {
                memberId: 'member-2',
                meta: {
                    guildMetrics: {
                        'guild-1': {
                            hilariousReacts: {
                                receivedCount: 30,
                            },
                        },
                    },
                },
            },
            {
                memberId: 'member-4',
                meta: {
                    guildMetrics: {
                        'guild-2': {
                            hilariousReacts: {
                                receivedCount: 99,
                            },
                        },
                    },
                },
            },
        ]);

        const leaderboard = await getHilariousLeaderboard('guild-1', 10);

        expect(leaderboard).toEqual([
            { memberId: 'member-1', total: 30 },
            { memberId: 'member-2', total: 30 },
            { memberId: 'member-3', total: 10 },
        ]);
    });

    test('announces milestone messages in-channel when a qualifying reaction is added', async () => {
        mockGetMemberRecord.mockResolvedValue({
            memberId: 'author-1',
            prefix: null,
            meta: {
                guildMetrics: {
                    'guild-1': {
                        hilariousReacts: {
                            receivedCount: 24,
                            reactedBy: {},
                            milestonesAnnounced: [],
                        },
                    },
                },
            },
        });

        const send = jest.fn().mockResolvedValue(undefined);
        const result = await handleHilariousReactionAdd(
            {
                emoji: {
                    name: 'hilarious',
                    toString: jest.fn().mockReturnValue('<:hilarious:12345>'),
                },
                message: {
                    id: 'message-1',
                    guildId: 'guild-1',
                    author: {
                        id: 'author-1',
                        username: 'Author',
                        bot: false,
                    },
                    channel: { send },
                    client: {
                        users: {
                            fetch: mockFetchUser,
                        },
                    },
                    guild: null,
                },
            },
            {
                id: 'reactor-1',
                bot: false,
            }
        );

        expect(result).toEqual({
            counted: true,
            total: 25,
            milestoneReached: true,
            displayName: 'Author',
        });
        expect(send).toHaveBeenCalledWith('Author has received 25 <:hilarious:12345> reacts!');
    });

    test('attributes hilarious reacts on webhook-owned messages to the owning user', async () => {
        mockGetMemberRecord.mockResolvedValue({
            memberId: 'owner-1',
            prefix: null,
            meta: {
                guildMetrics: {
                    'guild-1': {
                        hilariousReacts: {
                            receivedCount: 24,
                            reactedBy: {},
                            milestonesAnnounced: [],
                        },
                    },
                },
            },
        });
        mockGetMessageById.mockResolvedValue({
            message_id: 'message-1',
            meta: {
                kind: 'twitter_render',
                owningUserId: 'owner-1',
                username: 'impersonated name',
            },
        });
        mockFetchUser.mockResolvedValue({
            id: 'owner-1',
            username: 'OwnerUser',
            globalName: 'Owner Display',
        });

        const send = jest.fn().mockResolvedValue(undefined);
        const result = await handleHilariousReactionAdd(
            {
                emoji: {
                    name: 'hilarious',
                    toString: jest.fn().mockReturnValue('<:hilarious:12345>'),
                },
                message: {
                    id: 'message-1',
                    guildId: 'guild-1',
                    author: {
                        id: 'bot-author',
                        username: 'SOUL',
                        bot: true,
                    },
                    channel: { send },
                    client: {
                        users: {
                            fetch: mockFetchUser,
                        },
                    },
                    guild: null,
                },
            },
            {
                id: 'reactor-1',
                bot: false,
            }
        );

        expect(mockGetMessageById).toHaveBeenCalledWith('message-1');
        expect(mockUpsertMemberRecord).toHaveBeenCalledWith(expect.objectContaining({
            memberId: 'owner-1',
        }));
        expect(result).toEqual({
            counted: true,
            total: 25,
            milestoneReached: true,
            displayName: 'Owner Display',
        });
        expect(send).toHaveBeenCalledWith('Owner Display has received 25 <:hilarious:12345> reacts!');
    });
});
