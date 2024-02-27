const ffmpeg = require('fluent-ffmpeg');

/**
 * 
 * @param {*} framesPattern 
 * @param {*} outputVideoPath 
 * @param {*} frameRate 
 */
function framesToVideo(framesPattern, outputVideoPath, frameRate = 25) {
    ffmpeg()
        .input(framesPattern)
        .inputFPS(frameRate)
        .output(outputVideoPath)
        .on('end', function() {
            console.log('Video creation completed.');
        })
        .on('error', function(err) {
            console.error('An error occurred: ' + err.message);
        })
        .run();
}
