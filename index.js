const { Events } = require('discord.js');
const { client } = require('./initial_client.js');
const { initializeDataStore } = require('./initial_store.js');
const { initializeListeners } = require('./message_listeners/core.js');
const { initializeEvents } = require('./events/guild_member_update.js');
require('dotenv').config();
const token = process.env.DISCORD_BOT_TOKEN;

const path = process.env.STORE_PATH;
const guildFile = process.env.GUILD_STORE_FILE;
const channelFile = process.env.CHANNEL_STORE_FILE;
const memberFIle = process.env.MEMBER_STORE_FILE;

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

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  // TODO: Print successful websockets connection?
});

initializeListeners(client);
initializeEvents(client);

client.login(token);