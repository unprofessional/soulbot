const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
} = require('node:fs');

const { downloadVideo } = require('../features/twitter-video');

describe('Twitter video downloads', () => {
    const servers = [];
    const tempDirs = [];

    async function startServer(handler) {
        const server = http.createServer(handler);
        servers.push(server);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        return `http://127.0.0.1:${port}/video.mp4`;
    }

    function outputPath() {
        const dir = mkdtempSync(path.join(os.tmpdir(), 'soulbot-video-download-'));
        tempDirs.push(dir);
        return path.join(dir, 'video.mp4');
    }

    afterEach(async () => {
        for (const server of servers.splice(0)) {
            server.closeIdleConnections?.();
            server.closeAllConnections?.();
            await new Promise(resolve => server.close(resolve));
        }
        for (const dir of tempDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('streams large responses byte-for-byte and records downloaded bytes', async () => {
        const source = Buffer.alloc((512 * 1024) + 137, 0x5a);
        const url = await startServer((request, response) => {
            response.writeHead(200, { 'content-type': 'video/mp4' });
            for (let offset = 0; offset < source.length; offset += 16384) {
                response.write(source.subarray(offset, offset + 16384));
            }
            response.end();
        });
        const destination = outputPath();
        const telemetry = {
            measure: jest.fn(async (_stage, operation, details) => {
                const result = await operation();
                telemetry.details = details(result);
                return result;
            }),
        };

        await expect(downloadVideo(url, destination, { telemetry, timeoutMs: 5000 }))
            .resolves.toBe(source.length);
        expect(readFileSync(destination)).toEqual(source);
        expect(telemetry.measure).toHaveBeenCalledWith('download', expect.any(Function), expect.any(Function));
        expect(telemetry.details).toEqual({ downloadedBytes: source.length });
    });

    test('rejects non-success responses without leaving a file', async () => {
        const url = await startServer((_request, response) => {
            response.writeHead(503);
            response.end('unavailable');
        });
        const destination = outputPath();

        await expect(downloadVideo(url, destination, { timeoutMs: 5000 }))
            .rejects.toThrow('HTTP 503');
        expect(existsSync(destination)).toBe(false);
    });

    test('removes a partial file when the response terminates early', async () => {
        const url = await startServer((_request, response) => {
            response.writeHead(200, { 'content-type': 'video/mp4' });
            response.write(Buffer.alloc(65536, 0x2a));
            response.destroy();
        });
        const destination = outputPath();

        await expect(downloadVideo(url, destination, { timeoutMs: 5000 })).rejects.toThrow();
        expect(existsSync(destination)).toBe(false);
    });

    test('times out a stalled response and removes the partial file', async () => {
        const url = await startServer((_request, response) => {
            response.writeHead(200, { 'content-type': 'video/mp4' });
            response.write(Buffer.alloc(1024, 0x1a));
        });
        const destination = outputPath();

        await expect(downloadVideo(url, destination, { timeoutMs: 40 }))
            .rejects.toMatchObject({ code: 'VIDEO_DOWNLOAD_TIMEOUT' });
        expect(existsSync(destination)).toBe(false);
    });

    test('honors caller cancellation and removes the partial file', async () => {
        const url = await startServer((_request, response) => {
            response.writeHead(200, { 'content-type': 'video/mp4' });
            response.write(Buffer.alloc(1024, 0x1a));
        });
        const destination = outputPath();
        const controller = new AbortController();
        const download = downloadVideo(url, destination, {
            signal: controller.signal,
            timeoutMs: 5000,
        });
        setTimeout(() => controller.abort(new Error('cancelled by test')), 20);

        await expect(download).rejects.toThrow();
        expect(existsSync(destination)).toBe(false);
    });

    test('rejects disk write failures without replacing the target directory', async () => {
        const url = await startServer((_request, response) => {
            response.writeHead(200, { 'content-type': 'video/mp4' });
            response.end(Buffer.alloc(4096, 0x3a));
        });
        const destination = outputPath();
        mkdirSync(destination);

        await expect(downloadVideo(url, destination, { timeoutMs: 5000 })).rejects.toThrow();
        expect(existsSync(destination)).toBe(true);
    });
});
