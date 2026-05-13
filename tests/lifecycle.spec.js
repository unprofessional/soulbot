function loadLifecycle() {
    jest.resetModules();
    return require('../app/lifecycle.js');
}

describe('lifecycle drain handlers', () => {
    test('drain runs registered drain handlers when the pod enters draining', async () => {
        const {
            drain,
            getState,
            registerDrainHandler,
        } = loadLifecycle();
        const handler = jest.fn().mockResolvedValue();

        registerDrainHandler('test drain handler', handler);

        await drain('preStop hook');

        expect(getState()).toMatchObject({
            isDraining: true,
            shutdownReason: 'preStop hook',
        });
        expect(handler).toHaveBeenCalledWith('preStop hook');
    });

    test('shutdown reuses the existing drain and does not run handlers twice', async () => {
        const {
            drain,
            registerDrainHandler,
            shutdown,
        } = loadLifecycle();
        const handler = jest.fn().mockResolvedValue();

        registerDrainHandler('test drain handler', handler);

        await drain('preStop hook');
        await shutdown({ signal: 'SIGTERM', exitCode: 0 });

        expect(handler).toHaveBeenCalledTimes(1);
    });
});
