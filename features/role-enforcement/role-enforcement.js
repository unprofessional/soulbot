const catchPhrases = [
    ' but its not like i care or anything',
    ' but idrc',
    ' but thats cringe',
];

const getRandomCatchPhrase = () => {
    const randomIndex = Math.floor(Math.random() * catchPhrases.length);
    return catchPhrases[randomIndex];
};

const getTemplateResult = (userId, originalMsg, randomCatchphrase) => `<@${userId}> wants you to know: ${originalMsg} ${randomCatchphrase}`;

const enforceGoldyRole = async (message) => {
    if(message.author.id === '983754855795527710') {

        const goldyUser = await message.guild.members.fetch('983754855795527710');
        const roleNames =  goldyUser.roles.cache.map(role => role.name);
        console.log('>>> enforceGoldyRole > roleNames: ', roleNames);
        const rolesContainGoldyRole = roleNames.includes('goldy');
        console.log('>>> enforceGoldyRole > rolesContainGoldyRole: ', rolesContainGoldyRole);

        if(rolesContainGoldyRole) {
            try {
                const originalMsg = message.content;
                const randomCatchphrase = getRandomCatchPhrase();
                console.log('>>> enforceGoldyRole > randomCatchphrase: ', randomCatchphrase);
                const templateResult = getTemplateResult(message.author.id, originalMsg, randomCatchphrase);
                console.log('>>> enforceGoldyRole > templateResult: ', templateResult);
                await message.delete();
                await message.channel.send(templateResult);
            } catch (err) {
                console.error('>>> enforceGoldyRole > err: ', err);
            }
        }
    }

};

module.exports = { enforceGoldyRole };
