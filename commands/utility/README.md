### https://discordjs.guide/creating-your-bot/command-deployment.html#command-registration

# Command registration
Slash commands can be registered in two ways; in one specific guild, or for every guild the bot is in. We're going to look at single-guild registration first, as this is a good way to develop and test your commands before a global deployment.

Your application will need the applications.commands scope authorized in a guild for any of its slash commands to appear, and to be able to register them in a specific guild without error.

Slash commands only need to be registered once, and updated when the definition (description, options etc) is changed. As there is a daily limit on command creations, it's not necessary nor desirable to connect a whole client to the gateway or do this on every ready event. As such, a standalone script using the lighter REST manager is preferred.

This script is intended to be run separately, only when you need to make changes to your slash command definitions - you're free to modify parts such as the execute function as much as you like without redeployment.