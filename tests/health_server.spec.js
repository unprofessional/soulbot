jest.mock('../app/lifecycle.js', () => ({
    drain: jest.fn(),
    getState: jest.fn(),
}));

const { drain, getState } = require('../app/lifecycle.js');
const { handleHealthRequest } = require('../app/health_server.js');

describe('health server', () => {
    beforeEach(() => {
        drain.mockReset();
        getState.mockReset();
    });

    test('readyz returns 200 when ready', async () => {
        getState.mockReturnValue({
            isReady: true,
            isDraining: false,
            shutdownReason: null,
        });

        const response = createMockResponse();
        await handleHealthRequest({ method: 'GET', url: '/readyz' }, response);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            ok: true,
            status: 'ready',
        });
    });

    test('drain marks the process as draining', async () => {
        getState.mockReturnValue({
            isReady: true,
            isDraining: false,
            shutdownReason: null,
        });

        const response = createMockResponse();
        await handleHealthRequest(
            { method: 'GET', url: '/drain' },
            response,
            { drainDelayMs: 1 }
        );

        expect(response.statusCode).toBe(200);
        expect(drain).toHaveBeenCalledWith('preStop hook');
    });
});

function createMockResponse() {
    return {
        statusCode: null,
        headers: null,
        body: '',
        writeHead(statusCode, headers) {
            this.statusCode = statusCode;
            this.headers = headers;
        },
        end(body) {
            this.body = body;
        },
    };
}
