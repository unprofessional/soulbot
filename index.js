const { Events, ShardEvents, WebSocketShardEvents } = require('discord.js');
const { client } = require('./initial_client.js');
const { initializeDataStore } = require('./initial_store.js');
const { initializeListeners } = require('./message_listeners/core.js');
const { initializeCommands } = require('./initial_commands.js');
const { initializeGuildMemberUpdate } = require('./events/guild_member_update.js');
const { initializeGuildMemberRemove } = require('./events/guild_member_remove.js');
const { testPgConnection, initializeDB } = require('./store/db/db.js');
const { testChromaConnection } = require('./features/ollama/embed.js');
const { registerFonts } = require('./features/twitter-post/canvas/fonts.js');
const { initializeGuildMemberAdd } = require('./events/guild_member_add.js');

require('dotenv').config();

const token = process.env.DISCORD_BOT_TOKEN;
const path = process.env.STORE_PATH;
const guildFile = process.env.GUILD_STORE_FILE;
const channelFile = process.env.CHANNEL_STORE_FILE;
const memberFile = process.env.MEMBER_STORE_FILE;
const featureFile = process.env.FEATURE_STORE_FILE;
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

    /**
     * Data stores
     */
    [
        guildFile,
        channelFile,
        memberFile,
        featureFile,
    ].forEach((file) => {
        const filePath = `${path}/${file}`;
        initializeDataStore(filePath);
    });

    /**
     * Client lifecycle
     */
    client.on(Events.ClientReady, () => {
        console.log(`----- Events: Logged in as ${client.user.tag}`);
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

    try {
        const result = await testChromaConnection();
        console.log(result);
    } catch (error) {
        console.error('ChromaDB connection test failed:', error.message);
        // intentionally non-fatal
    }

    await initializeDB();

    /**
     * Login last — nothing should create canvases before this point
     */
    await client.login(token);
};

initializeApp().catch((error) => {
    console.error('Error during initialization:', error);
    process.exit(1);
});
