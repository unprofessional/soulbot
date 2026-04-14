const http = require('node:http');

const { getState, startDraining } = require('./lifecycle.js');
const { getActiveJobs } = require('./media_work_registry.js');

async function handleHealthRequest(req, res, { drainDelayMs = 10000 } = {}) {
    const { method, url } = req;
    const state = getState();

    if (method === 'GET' && url === '/livez') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, status: 'live' }));
        return;
    }

    if (method === 'GET' && url === '/readyz') {
        const statusCode = state.isReady && !state.isDraining ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: statusCode === 200,
            status: statusCode === 200 ? 'ready' : 'draining',
            activeMediaJobs: getActiveJobs(),
            ...state,
        }));
        return;
    }

    if (method === 'GET' && url === '/drain') {
        startDraining('preStop hook');

        await new Promise((resolve) => {
            setTimeout(resolve, drainDelayMs);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: true,
            status: 'draining',
            drainDelayMs,
        }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
}

function createHealthServer({
    port,
    host = '0.0.0.0',
    drainDelayMs = 10000,
} = {}) {
    let server;

    return {
        async start() {
            if (server) {
                return server;
            }

            server = http.createServer((req, res) => {
                handleHealthRequest(req, res, { drainDelayMs }).catch((error) => {
                    console.error('[HealthServer] Request failed:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'internal_error' }));
                });
            });

            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(port, host, () => {
                    server.off('error', reject);
                    console.log(`[HealthServer] Listening on ${host}:${port}`);
                    resolve();
                });
            });

            return server;
        },

        async stop() {
            if (!server) {
                return;
            }

            const activeServer = server;
            server = null;

            await new Promise((resolve, reject) => {
                activeServer.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        },
    };
}

module.exports = {
    createHealthServer,
    handleHealthRequest,
};
