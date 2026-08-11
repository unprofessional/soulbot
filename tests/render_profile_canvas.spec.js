const mockCreateProfileCanvas = jest.fn();

jest.mock('../features/discord-profile/profile_canvas.js', () => ({
    createProfileCanvas: mockCreateProfileCanvas,
}));

const { renderProfileCanvas } = require('../features/discord-profile/render_profile_canvas.js');

describe('renderProfileCanvas', () => {
    test('sends welcome content, a constrained user mention, and the member card together', async () => {
        const buffer = Buffer.from('member-card');
        mockCreateProfileCanvas.mockResolvedValue(buffer);
        const channel = { send: jest.fn().mockResolvedValue({}) };
        const guildMember = { user: { id: 'user-1' } };

        await renderProfileCanvas(guildMember, channel, {
            content: 'Welcome <@user-1>',
        });

        expect(channel.send).toHaveBeenCalledWith({
            content: 'Welcome <@user-1>',
            allowedMentions: {
                parse: [],
                users: ['user-1'],
            },
            files: [{
                attachment: buffer,
                name: 'member-card.png',
            }],
        });
    });
});
