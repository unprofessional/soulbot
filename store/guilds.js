const DAO = require('./store.dao.js');
require('dotenv').config();
const path = process.env.STORE_PATH;
const file = process.env.GUILD_STORE_FILE;
const filePath = `${path}/${file}`;
const guildDAO = new DAO(filePath);
const guilds = guildDAO.initializeLocalStore().guilds || [];
console.log('>>>>> guilds: ', guilds)

// TODO: Consider adding return booleans for success/failure scenarios
const addGuild = (guildId, message) => {
  try {
    if(guilds.includes(guildId)) {
      throw new Error('Server already exists!');
    }
    message.channel.send('Adding server to the list...');
    guilds.push(guildId); // if it works, return updated ref, else return nothing
    guildDAO.save({ guilds });
  }
  catch (err) {
    message.channel.send('Server already exists!');
  }
};

const getGuilds = (client) => {
  const guildNames = [];
  client.guilds.cache.forEach((guild) => {
    // console.log('!!!!! guild.name: ', guild.name);

    // Find the guild name from the guildId in the list....
    guilds.forEach(guildId => {
      if(guildId === guild.id) {
        guildNames.push(guild.name);
      }
    });

  });

  // console.log('>>>>> guildNames: ', guildNames);
  // return guildNames;
  
  let guildNamesStringFormatted = "";
  guildNames.forEach((guildName) => {
    guildNamesStringFormatted += `\`${guildName}\`, ` // TODO: fix singular dangling comma
  })
  console.log('>>>>> guildNamesStringFormatted: ', guildNamesStringFormatted);
  return guildNamesStringFormatted;
};

const removeGuild = (guildId) => {
  return guilds.filter((_guildId) => _guildId === guildId);
};

/**
 * 
 * @param {*} guildId 
 * @returns true if guild is supported
 */
const guildIsSupported = (guildId) => {
  return guilds.includes(guildId);
}

module.exports = { 
  guilds,
  addGuild,
  getGuilds,
  removeGuild,
  guildIsSupported,
};