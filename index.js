// index.js
const { Events, ShardEvents, WebSocketShardEvents } = require('discord.js');
const { client } = require('./initial_client.js');
const { initializeListeners } = require('./message_listeners/core.js');
const { initializeCommands } = require('./initial_commands.js');
const { initializeGuildMemberUpdate } = require('./events/guild_member_update.js');
const { initializeGuildMemberRemove } = require('./events/guild_member_remove.js');
const { closeDB, testPgConnection, initializeDB } = require('./store/db/db.js');
const { testChromaConnection } = require('./features/ollama/embed.js');
const { registerFonts } = require('./features/twitter-post/canvas/fonts.js');
const { initializeGuildMemberAdd } = require('./events/guild_member_add.js');
const { createHealthServer } = require('./app/health_server.js');
const {
    isDraining,
    markReady,
    registerCleanup,
    shutdown,
} = require('./app/lifecycle.js');
const PromiseQueue = require('./lib/promise_queue.js');
const { onIdle: onMediaWorkIdle } = require('./app/media_work_registry.js');
const {
    drainDelayMs,
    healthPort,
    leaderLockId,
    leaderLockRetryMs,
    shutdownTimeoutMs,
} = require('./config/env_config.js');
const { createLeaderLock } = require('./store/db/leader_lock.js');

require('dotenv').config();

const token = process.env.DISCORD_BOT_TOKEN;
const runMode = process.env.RUN_MODE || 'development';

const initializeApp = async () => {
    // CI / build-time sanity check
    if (runMode === 'test') {
        console.log('Syntax check passed.');
        process.exit(0);
    }

    /**
     * Font bootstrap (process-global)
     * Must happen before ANY canvas is created.
     */
    try {
        const { registered, skipped } = registerFonts();
        console.log(
            `----- Fonts: registered=${registered.length}, skipped=${skipped.length}`
        );
    } catch (error) {
        console.error('----- Fonts: failed to register fonts:', error);
        process.exit(1);
    }

    const healthServer = createHealthServer({
        port: healthPort,
        drainDelayMs,
    });
    const leaderLock = createLeaderLock({
        lockId: leaderLockId,
        retryDelayMs: leaderLockRetryMs,
    });

    await healthServer.start();

    registerCleanup('pause async queues', async () => {
        PromiseQueue.pauseAll();
        await PromiseQueue.onIdleAll();
    });

    registerCleanup('wait for twitter/media work', async () => {
        await onMediaWorkIdle();
    });

    registerCleanup('close health server', async () => {
        await healthServer.stop();
    });

    registerCleanup('disconnect Discord client', async () => {
        if (client.isReady()) {
            await client.destroy();
            console.log('----- Events: Discord client destroyed');
        }
    });

    registerCleanup('close Postgres pool', async () => {
        await closeDB();
    });

    registerCleanup('release leader lock', async () => {
        await leaderLock.close();
    });

    /**
     * Client lifecycle
     */
    client.on(Events.ClientReady, () => {
        console.log(`----- Events: Logged in as ${client.user.tag}`);
        markReady();
    });
    client.on(Events.Error, (error) => {
        console.error('----- Events: Error:', error);
    });
    client.on(Events.Warn, (warning) => {
        console.error('----- Events: Warn:', warning);
    });

    /**
     * Shard events
     */
    client.on(ShardEvents.Disconnect, () => {
        console.log('----- ShardEvents: Disconnect');
    });
    client.on(ShardEvents.Reconnecting, () => {
        console.log('----- ShardEvents: Reconnecting');
    });
    client.on(ShardEvents.Error, (error) => {
        console.error('----- ShardEvents: Error:', error);
    });
    client.on(ShardEvents.Death, () => {
        console.log('----- ShardEvents: Death');
    });
    client.on(ShardEvents.Message, () => {
        console.log('----- ShardEvents: Message');
    });
    client.on(ShardEvents.Resume, () => {
        console.error('----- ShardEvents: Resume');
    });
    client.on(ShardEvents.Spawn, () => {
        console.error('----- ShardEvents: Spawn');
    });

    /**
     * WebSocket events
     */
    client.on(WebSocketShardEvents.Ready, () => {
        console.log('----- WebSocketShardEvents: Ready');
    });
    client.on(WebSocketShardEvents.AllReady, () => {
        console.log('----- WebSocketShardEvents: AllReady');
    });
    client.on(WebSocketShardEvents.Resumed, () => {
        console.log('----- WebSocketShardEvents: Resumed');
    });
    client.on(WebSocketShardEvents.Close, () => {
        console.error('----- WebSocketShardEvents: Closed');
    });
    client.on(WebSocketShardEvents.Destroyed, () => {
        console.error('----- WebSocketShardEvents: Destroyed');
    });
    client.on(WebSocketShardEvents.InvalidSession, () => {
        console.error('----- WebSocketShardEvents: InvalidSession');
    });

    /**
     * Feature initialization
     */
    initializeListeners(client);
    initializeCommands(client);
    initializeGuildMemberUpdate(client);
    initializeGuildMemberAdd(client);
    initializeGuildMemberRemove(client);

    /**
     * Persistence / external services
     */
    await testPgConnection();

    await initializeDB();

    try {
        const result = await testChromaConnection();
        console.log(result);
    } catch (error) {
        console.error('ChromaDB connection test failed:', error.message);
        // intentionally non-fatal
    }

    await leaderLock.acquire({
        shouldStop: () => isDraining(),
    });

    /**
     * Login last — nothing should create canvases before this point
     */
    await client.login(token);
};

async function handleShutdown(signal) {
    const timeout = setTimeout(() => {
        console.error(`[Lifecycle] Forced shutdown after ${shutdownTimeoutMs}ms`);
        process.exit(1);
    }, shutdownTimeoutMs);
    timeout.unref?.();

    try {
        const exitCode = await shutdown({ signal, exitCode: 0 });
        clearTimeout(timeout);
        process.exit(exitCode);
    } catch (error) {
        clearTimeout(timeout);
        console.error('[Lifecycle] Shutdown failed:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => {
    void handleShutdown('SIGTERM');
});

process.on('SIGINT', () => {
    void handleShutdown('SIGINT');
});

initializeApp().catch((error) => {
    console.error('Error during initialization:', error);
    process.exit(1);
});
