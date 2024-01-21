const {
    createCanvas,
    loadImage,
} = require('canvas');

const TimeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

const formatDiscordDate = (discordDate) => {
    // Parse the date string and create a Date object
    const date = new Date(discordDate);
    return timeAgo.format(date); 
};

const createProfileCanvas = async (guildMember) => {

    console.log('>>>>> createProfileCanvas > guildMember: ', guildMember);

    // Unnecessary if the font is loaded in the local OS
    // TODO: Investigate if `fonts/` is even necessary...
    // registerFont('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', { family: 'Noto Color Emoji' });
    const globalFont = 'Arial';

    const canvasWidth = 300;
    const canvasHeight = 300;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const drawBasicElements = async (guildMember) => {

        const { user, joinedTimestamp } = guildMember;
        const { id, bot, username, globalName, avatar } = user;

        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;

        // Draw global name elements
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px ' + globalFont;
        ctx.fillText(globalName, 100, 40);

        // Draw joined date elements
        ctx.fillStyle = 'gray';
        ctx.font = '18px ' + globalFont;
        ctx.fillText(`${joinedTimestamp}`, 100, 60);
  
        // Draw pfp image
        try {
            const avatar = await loadImage(avatarUrl);
            ctx.drawImage(avatar, 20, 20, 50, 50);
        } catch (err) {
            console.log('>>> Avatar could not load! err: ', err);
        }
    };
    await drawBasicElements(guildMember);

    // Convert the canvas to a Buffer and return it
    return canvas.toBuffer();
};

module.exports = { createProfileCanvas };
