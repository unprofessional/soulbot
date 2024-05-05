const catchPhrases = [
    ' but its not like i care or anything',
    ' but idrc',
    ' but thats cringe',
];

const getRandomCatchPhrase = () => {
    const randomIndex = Math.floor(Math.random() * catchPhrases.length);
    return catchPhrases[randomIndex];
};

const getTemplateResult = (userId, originalMsg, randomCatchphrase) => `<@${userId}> is rancid: ${originalMsg} ${randomCatchphrase}`;

const enforceGoldyRole = async (message) => {
    if(message.author.id === '983754855795527710') {

        const goldyUser = await message.guild.members.fetch('983754855795527710');
        const roleNames =  goldyUser.roles.cache.map(role => role.name);
        const rolesContainGoldyRole = roleNames.includes('goldy');

        if(rolesContainGoldyRole) {
            try {
                const originalMsg = message.content;
                const randomCatchphrase = getRandomCatchPhrase();
                const templateResult = getTemplateResult(message.author.id, originalMsg, randomCatchphrase);
                await message.delete();
                await message.channel.send(templateResult);
            } catch (err) {
                console.error('>>> enforceGoldyRole > err: ', err);
            }
        }
    }

};

module.exports = { enforceGoldyRole };
