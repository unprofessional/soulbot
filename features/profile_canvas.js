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

    const maxCanvasWidth = 300;
    let canvasHeight = 300;
    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    const drawBasicElements = (guildMember) => {

        const { user } = guildMember;
        const { bot, username, globalName, avatar } = user;

        // Load and draw favicon
        // ctx.drawImage(favicon, 550, 20, 32, 32);

        // Draw nickname elements
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px ' + globalFont;
        // ctx.fillText(metadata.authorUsername, 100, 40);

        // Draw username elements
        ctx.fillStyle = 'gray';
        ctx.font = '18px ' + globalFont;
        // ctx.fillText(`@${metadata.authorNick}`, 100, 60);
  
        // Draw pfp image
        // ctx.drawImage(pfp, 20, 20, 50, 50);
    };
    drawBasicElements(guildMember);

    // Convert the canvas to a Buffer and return it
    return canvas.toBuffer();
};

module.exports = { createProfileCanvas };
