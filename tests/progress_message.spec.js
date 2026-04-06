const { createVideoProgressMessage } = require('../features/twitter-core/progress_message.js');

describe('createVideoProgressMessage', () => {
    test('creates a reply progress message and dismisses it safely', async () => {
        const progressMessage = {
            edit: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };
        const message = {
            reply: jest.fn().mockResolvedValue(progressMessage),
            channel: {
                send: jest.fn(),
            },
        };

        const handle = await createVideoProgressMessage(message, 'Working...');

        await handle.update('Uploading...');
        await handle.dismiss();

        expect(message.reply).toHaveBeenCalledWith({
            content: 'Working...',
            allowedMentions: { repliedUser: false },
        });
        expect(progressMessage.edit).toHaveBeenCalledWith({ content: 'Uploading...' });
        expect(progressMessage.delete).toHaveBeenCalledTimes(1);
    });

    test('falls back to channel send when reply creation fails', async () => {
        const progressMessage = {
            edit: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };
        const message = {
            reply: jest.fn().mockRejectedValue(new Error('cannot reply')),
            channel: {
                send: jest.fn().mockResolvedValue(progressMessage),
            },
        };

        const handle = await createVideoProgressMessage(message, 'Working...');

        await handle.dismiss();

        expect(message.channel.send).toHaveBeenCalledWith({ content: 'Working...' });
        expect(progressMessage.delete).toHaveBeenCalledTimes(1);
    });
});
