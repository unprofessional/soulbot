const {
    createVideoProgressMessage,
    formatVideoEncodeProgress,
} = require('../features/twitter-core/progress_message.js');

describe('createVideoProgressMessage', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

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

    test('formats a readable encode progress bar', () => {
        expect(formatVideoEncodeProgress({
            percent: 62,
            currentSeconds: 25.4,
            totalSeconds: 40.8,
        })).toBe('Encoding Twitter/X video... ███████░░░░░ 62% (00:25 / 00:40)');
    });

    test('throttles live encode progress edits but forces the final 100% update', async () => {
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
        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy
            .mockReturnValueOnce(1000)
            .mockReturnValueOnce(1100)
            .mockReturnValueOnce(3000);

        const handle = await createVideoProgressMessage(message, 'Working...');

        await handle.updateVideoEncodeProgress({
            percent: 10,
            currentSeconds: 4,
            totalSeconds: 40,
        });
        await handle.updateVideoEncodeProgress({
            percent: 12,
            currentSeconds: 5,
            totalSeconds: 40,
        });
        await handle.updateVideoEncodeProgress({
            percent: 100,
            currentSeconds: 40,
            totalSeconds: 40,
        });

        expect(progressMessage.edit).toHaveBeenCalledTimes(2);
        expect(progressMessage.edit.mock.calls[0][0]).toEqual({
            content: 'Encoding Twitter/X video... █░░░░░░░░░░░ 10% (00:04 / 00:40)',
        });
        expect(progressMessage.edit.mock.calls[1][0]).toEqual({
            content: 'Encoding Twitter/X video... ████████████ 100% (00:40 / 00:40)',
        });
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
