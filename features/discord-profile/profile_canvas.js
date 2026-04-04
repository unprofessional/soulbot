// features/discord-profile/profile_canvas.js
const {
    createCanvas,
    loadImage,
} = require('canvas');
const TimeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
TimeAgo.addDefaultLocale(en);

const createProfileCanvas = async (guildMember) => {

    const globalFont = 'Arial';

    const canvasWidth = 300;
    const canvasHeight = 300;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const drawBasicElements = async (guildMember) => {

        const { user } = guildMember;
        const { id, username, globalName, avatar } = user;

        const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;

        // Draw global nickname elements
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px ' + globalFont;
        ctx.fillText(`${globalName}`, 20, 30);
        
        // Draw username elements
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px ' + globalFont;
        ctx.fillText(`@${username}`, 20, 50);

        // Draw joined date elements
        ctx.fillStyle = 'gray';
        ctx.font = '18px ' + globalFont;
        // ctx.fillText(`joined ${formattedTimeAgo}`, 20, 280);
        ctx.fillText('has joined', 200, 280);
  
        // Draw pfp image
        try {
            const avatar = await loadImage(avatarUrl);
            ctx.drawImage(avatar, 60, 60, 180, 180);
        } catch (err) {
            console.log('>>> Avatar could not load! err: ', err);
        }

        /**
         * TODO — stateless data
         * 1) numTimesEntered
         * 2) 
         */
    };
    await drawBasicElements(guildMember);

    // Convert the canvas to a Buffer and return it
    return canvas.toBuffer();
};

module.exports = { createProfileCanvas };
