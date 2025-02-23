const prefixes = [
    'wants you to know',
    'is still here',
    'wants attention',
    'desperately insists',
    'thinks she matters',
];

const catchPhrases = [
    'but its not like i care or anything',
    'but idrc',
    'but thats cringe',
    'but thats pathetic coded',
    'but shrug',
    'but seethe away',
    'but thats so cute',
    'but thats boring'
];

const getRandomPrefixes = () => {
    const randomIndex = Math.floor(Math.random() * prefixes.length);
    return prefixes[randomIndex];
};

const getRandomCatchPhrase = () => {
    const randomIndex = Math.floor(Math.random() * catchPhrases.length);
    return catchPhrases[randomIndex];
};

const getTemplateResult = (userId, randomPrefix, originalMsg, randomCatchphrase) => `<@${userId}> ${randomPrefix}: ${originalMsg} ${randomCatchphrase}`;

const enforceGoldyRole = async (message) => {

    if (!message.guild) return;

    try {
        const memberId = message.author.id;
        const targetUser = await message.guild.members.fetch(memberId);
        const roleNames =  targetUser.roles.cache.map(role => role.name.toLowerCase());
        // console.log('>>> enforceGoldyRole > roleNames: ', roleNames);
        const rolesContainGoldyRole = roleNames.includes('goldy');
        // console.log('>>> enforceGoldyRole > rolesContainGoldyRole: ', rolesContainGoldyRole);
  
        if(rolesContainGoldyRole) {
            const originalMsg = message.content;
            const randomPrefix = getRandomPrefixes();
            const randomCatchphrase = getRandomCatchPhrase();
            const templateResult = getTemplateResult(memberId, randomPrefix, originalMsg, randomCatchphrase);
            // console.log('>>> enforceGoldyRole > randomCatchphrase: ', randomCatchphrase);
            try {
                await message.delete();
                await message.channel.send(templateResult);
            } catch (deleteError) {
                console.error('Failed to delete or send message:', deleteError);
                // Optionally send an error message to the channel
                // await message.channel.send("Oops! Something went wrong.");
            }
        }
    } catch (err) {
        console.error('>>> enforceGoldyRole > err: ', err);
    }
};

module.exports = { enforceGoldyRole };
