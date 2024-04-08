const ffmpeg = require('fluent-ffmpeg');

/**
 * 
 * @param {*} videoPath 
 * @param {*} frameRate 
 */
function extractFrames(videoPath, frameRate = 1) {
    ffmpeg(videoPath)
        .output('frame_%03d.png')
        .outputOptions([`-vf fps=${frameRate}`])
        .on('end', function() {
            console.log('Frames extraction completed.');
        })
        .on('error', function(err) {
            console.error('An error occurred: ' + err.message);
        })
        .run();
}
