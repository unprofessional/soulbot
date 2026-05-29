const mockSendWebhookProxyMsg = jest.fn();

jest.mock('../features/twitter-core/webhook_utils', () => ({
    sendWebhookProxyMsg: mockSendWebhookProxyMsg,
}));

const {
    enforceOwnerProxyRole,
    getRoleNames,
} = require('../features/role-enforcement/role-enforcement.js');

function buildMember(roleNames = []) {
    return {
        roles: {
            cache: new Map(
                roleNames.map((name, index) => [
                    String(index),
                    { name },
                ])
            ),
        },
    };
}

function buildMessage({ userId = '818606180095885332', content = 'hello world', roleNames = [] } = {}) {
    const member = buildMember(roleNames);

    return {
        guild: {
            members: {
                fetch: jest.fn().mockResolvedValue(member),
            },
        },
        author: {
            id: userId,
            bot: false,
        },
        member,
        content,
    };
}

describe('owner-proxy role enforcement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSendWebhookProxyMsg.mockResolvedValue(undefined);
    });

    test('normalizes role names to lowercase', () => {
        expect(getRoleNames(buildMember(['Owner-Proxy', 'Else'])))
            .toEqual(['owner-proxy', 'else']);
    });

    test('skips users who are not the configured owner', async () => {
        const message = buildMessage({ userId: 'someone-else', roleNames: ['owner-proxy'] });

        await expect(enforceOwnerProxyRole(message)).resolves.toBe(false);
        expect(mockSendWebhookProxyMsg).not.toHaveBeenCalled();
    });

    test('skips when the owner does not have the role', async () => {
        const message = buildMessage({ roleNames: ['member'] });

        await expect(enforceOwnerProxyRole(message)).resolves.toBe(false);
        expect(mockSendWebhookProxyMsg).not.toHaveBeenCalled();
    });

    test('replaces the owner message when the owner-proxy role is present', async () => {
        const message = buildMessage({
            roleNames: ['owner-proxy'],
            content: '  post this as proxy  ',
        });

        await expect(enforceOwnerProxyRole(message)).resolves.toBe(true);
        expect(mockSendWebhookProxyMsg).toHaveBeenCalledWith(message, 'post this as proxy');
    });

    test('skips blank messages', async () => {
        const message = buildMessage({
            roleNames: ['owner-proxy'],
            content: '   ',
        });

        await expect(enforceOwnerProxyRole(message)).resolves.toBe(false);
        expect(mockSendWebhookProxyMsg).not.toHaveBeenCalled();
    });
});
