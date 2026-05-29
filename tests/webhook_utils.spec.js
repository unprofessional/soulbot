const { buildAllowedMentions } = require('../features/twitter-core/webhook_utils.js');

describe('webhook mention parsing', () => {
    test('allows explicit user mentions already present in rendered content', () => {
        expect(buildAllowedMentions('<@1494795320436068453> <https://x.com/example/status/1>')).toEqual({
            parse: [],
            users: ['1494795320436068453'],
        });
    });

    test('deduplicates explicit user mentions and ignores non-user mention types', () => {
        expect(buildAllowedMentions('<@123> hi <@!123> <@&999> @everyone @here')).toEqual({
            parse: [],
            users: ['123'],
        });
    });

    test('preserves simulated reply target mentions when the target is a real user', () => {
        expect(buildAllowedMentions(
            '<@111> replied to <@222>\'s message: https://discord.com/channels/1/2/3\n>>> hello',
            {
                targetId: '222',
                targetIsWebhook: false,
            }
        )).toEqual({
            parse: [],
            users: ['111', '222'],
        });
    });

    test('does not allow webhook reply targets to be pinged', () => {
        expect(buildAllowedMentions(
            '<@111> replied to **SOUL**\'s message: https://discord.com/channels/1/2/3\n>>> hello',
            {
                targetId: '222',
                targetIsWebhook: true,
            }
        )).toEqual({
            parse: [],
            users: ['111'],
        });
    });
});
