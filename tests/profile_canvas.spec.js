const { createCanvas, loadImage } = require('canvas');

jest.mock('canvas', () => {
    const actual = jest.requireActual('canvas');
    return {
        ...actual,
        loadImage: jest.fn(async () => actual.createCanvas(512, 512)),
    };
});

const {
    CARD,
    createProfileCanvas,
    formatMemberSince,
    memberCardDataFromGuildMember,
    resolveBadge,
} = require('../features/discord-profile/profile_canvas.js');

function member(overrides = {}) {
    const user = {
        id: '12345',
        username: 'scoot',
        globalName: 'Scoot Global',
        bot: false,
        createdAt: new Date('2020-05-01T00:00:00Z'),
        displayAvatarURL: jest.fn(() => 'https://example.com/avatar.png'),
        avatarDecorationURL: jest.fn(() => null),
        flags: { toArray: () => ['PremiumEarlySupporter'] },
        ...overrides.user,
    };
    return {
        displayName: 'Scoot',
        displayColor: 0x9B78FF,
        ...overrides,
        user,
    };
}

describe('member profile canvas', () => {
    test('normalizes a guild member into card data', () => {
        expect(memberCardDataFromGuildMember(member())).toMatchObject({
            displayName: 'Scoot',
            username: '@scoot',
            avatarUrl: 'https://example.com/avatar.png',
            memberSinceLabel: 'Member since May 2020',
            accentColor: '#9B78FF',
            badge: { type: 'public', label: 'EARLY SUPPORTER', icon: 'star' },
        });
    });

    test('uses a bot badge in preference to public flags', () => {
        expect(resolveBadge(member({ user: { bot: true } }).user)).toEqual({
            type: 'bot', label: 'BOT', icon: 'bot',
        });
    });

    test('formats account creation month consistently in UTC', () => {
        expect(formatMemberSince(new Date('2018-11-30T23:30:00-05:00')))
            .toBe('Member since December 2018');
    });

    test('renders a 960 by 360 PNG', async () => {
        const buffer = await createProfileCanvas(member());
        const image = await jest.requireActual('canvas').loadImage(buffer);
        const surface = createCanvas(image.width, image.height);
        surface.getContext('2d').drawImage(image, 0, 0);

        expect(image.width).toBe(CARD.width);
        expect(image.height).toBe(CARD.height);
        expect(buffer.subarray(1, 4).toString()).toBe('PNG');
    });

    test('renders an initials fallback when the avatar cannot load', async () => {
        loadImage.mockRejectedValueOnce(new Error('avatar unavailable'));

        await expect(createProfileCanvas(member())).resolves.toBeInstanceOf(Buffer);
    });
});
