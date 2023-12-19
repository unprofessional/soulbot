const { Events, ShardEvents, WebSocketShardEvents } = require('discord.js');
const { client } = require('./initial_client.js');
const { initializeDataStore } = require('./initial_store.js');
const { initializeListeners } = require('./message_listeners/core.js');
// const { initializeTwitterListeners } = require('./message_listeners/twitter.js');
const { initializeCommands } = require('./initial_commands.js');
const { initializeGuildMemberUpdate } = require('./events/guild_member_update.js');
const { initializeGuildMemberAdd } = require('./events/guild_member_add.js');
const { initializeGuildMemberRemove } = require('./events/guild_member_remove.js');
require('dotenv').config();
const token = process.env.DISCORD_BOT_TOKEN;

const path = process.env.STORE_PATH;
const guildFile = process.env.GUILD_STORE_FILE;
const channelFile = process.env.CHANNEL_STORE_FILE;
const memberFIle = process.env.MEMBER_STORE_FILE;
const runMode = process.env.RUN_MODE || 'development';

// CI/Build/Function test
if (runMode === 'test') {
    console.log("Syntax check passed.");
    process.exit(0);
}

[
    guildFile,
    channelFile,
    memberFIle,
].forEach((file) => {
    console.log('>>>>> file: ', file);
    const filePath = `${path}/${file}`;
    console.log('>>>>> filePath: ', filePath);
    initializeDataStore(filePath);
});

// Client
client.on(Events.ClientReady, () => {
    console.log(`----- Events: Logged in as ${client.user.tag}`);
});
client.on(Events.Error, (error) => {
    console.error('----- Events: Error:', error);
});
client.on(Events.Warn, (warning) => {
    console.error('----- Events: Warn:', warning);
});
client.on(Events.Debug, (debug) => {
    console.error('----- Events: Debug:', debug);
});

// ShardEvents
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

// Websockets
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

initializeListeners(client);
// initializeTwitterListeners(client);
initializeCommands(client);
initializeGuildMemberUpdate(client);
initializeGuildMemberAdd(client);
initializeGuildMemberRemove(client);

client.login(token);
