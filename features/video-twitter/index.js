const path = require('node:path');
const {
    constants,
    // writeFile,
} = require('node:fs').promises;
const {
    // createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
} = require('node:fs');
// https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
var ffmpeg = require('fluent-ffmpeg');

const basePath = process.env.STORE_PATH;

/**
 * TODO: Refactor as utility file?
 * @param {*} filePath 
 * @returns 
 */
const ensureDirectoryExists = (filePath) => {
    const dirname = path.dirname(filePath);
    if (existsSync(dirname)) {
        return true;
    }
    mkdirSync(dirname, { recursive: true });
};

/**
 * For downloading large files like videos, it's often more efficient to stream
 * the data instead of loading the entire file into memory as a variable. This
 * approach is especially important for large videos to avoid high memory usage
 * and potential crashes.
 * @param {*} remoteFileUrl 
 * @param {*} outputPath
 * @returns a promise depending on fileStream write success or not
 */
const downloadVideo = async (remoteFileUrl, outputPath) => {
    ensureDirectoryExists(outputPath);
    const response = await fetch(remoteFileUrl);
    // console.log('>>>>> fetching video from URL...');
    const fileStream = createWriteStream(outputPath);
    // console.log('>>>>> creating Write Stream as fileStream...');

    // Use response.body as an async iterator to read chunks
    for await (const chunk of response.body) {
        // console.log('!!! writing chunk to fileStream');
        fileStream.write(chunk);
    }
    fileStream.end(); // we MUST close the stream
    // console.log('>>>>> fileStream write complete');
    return new Promise((resolve, reject) => {
        // console.log('...promise handler...');
        fileStream.on('finish', () => {
            console.log('fileStream finished! resolving!');
            return resolve(true);
        });
        fileStream.on('error', (err) => {
            console.log('fileStream error! rejecting! err: ', err);
            return reject(err);
        });
        // do we need a general on 'close' event capture?
    });
};

/**
 * Extract frames from the video at one frame per second
 * Each frame is written to the local file system as a .png per second of frame...
 * @param {*} localVideoPath 
 * @param {*} frameRate 
 */
function extractFrames(localVideoPath, frameRate = 20) {
    const pathParts = localVideoPath.split('/');
    // console.log('pathParts: ', pathParts);
    // console.log('pathParts.length: ', pathParts.length);
    const filenameWithExtension = pathParts[pathParts.length - 1];
    const filenameParts = filenameWithExtension.split('.');
    const filename = filenameParts[0];
    // console.log('filename: ', filename);
    const pathPartsWithoutFile = pathParts.splice(0, pathParts.length - 1);
    // console.log('pathPartsWithoutFile: ', pathPartsWithoutFile);
    const path = pathPartsWithoutFile.join('/');
    // console.log('path: ', path);

    return new Promise((resolve, reject) => {
        ffmpeg(localVideoPath)
            .output(`${path}/${filename}_%03d.png`)
            .outputOptions([`-vf fps=${frameRate}`])
            .on('end', function() {
                console.log('Frames extraction completed.');
                resolve(); // Resolve the promise when extraction is completed
            })
            .on('error', function(err) {
                console.error('An error occurred: ' + err.message);
                reject(err); // Reject the promise on error
            })
            .run();
    });
}

/**
 * After extracting the frames, you can process each one using node-canvas 
 * as described in the previous response. Once you have all the processed frames,
 * you can use fluent-ffmpeg again to combine them into a new video file:
 * @param {*} framesPattern 
 * @param {*} outputVideoPath 
 * @param {*} frameRate
 */
function recombineFramesToVideo(framesPattern, outputVideoPath, frameRate = 20) {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(framesPattern)
            .inputFPS(frameRate)
            .output(outputVideoPath)
            .videoCodec('libx264')
            .on('end', function() {
                console.log('Video creation completed.');
                resolve(); // Resolve the promise when extraction is completed
            })
            .on('error', function(err) {
                console.error('An error occurred: ' + err.message);
                reject(err); // Reject the promise on error
            })
            .run();
    });
}

/**
 * Extracts audio from a given video file and saves it as a separate audio file.
 * @param {*} videoPath - The path to the video file from which audio will be extracted.
 * @param {*} outputPath -The path to the audio file to be combined with the video (.mp3 or .wav)
 */
function extractAudioFromVideo(videoPath, outputPath) {
    console.log('>>>>> extractAudioFromVideo > videoPath: ', videoPath);
    console.log('>>>>> extractAudioFromVideo > outputPath: ', outputPath);
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(outputPath)
            .noVideo() // This option ensures no video is included in the output.
            .audioCodec('libmp3lame') // 'copy' copies the original audio without re-encoding, else specify the codec/format
            .on('end', function() {
                console.log('Audio extraction completed.');
                resolve(); // Resolve the promise when extraction is completed.
            })
            .on('error', function(err) {
                console.error('An error occurred during audio extraction: ' + err.message);
                reject(err); // Reject the promise on error.
            })
            .run();
    });
}

/**
 * Combines an audio file with a video file to create a new video with sound.
 * @param {*} videoPath - The path to the video file that will have audio added.
 * @param {*} audioPath - The path to the audio file to be combined with the video (.mp3 or .wav)
 * @param {*} outputPath - The path where the new video file with audio will be saved.
 */
function combineAudioWithVideo(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .output(outputPath)
            .videoCodec('copy') // This option copies the original video without re-encoding.
            .audioCodec('aac') // 'aac' codec is common enough
            .on('end', function() {
                console.log('Audio and video combination completed.');
                resolve(); // Resolve the promise when the combination is completed.
            })
            .on('error', function(err) {
                console.error('An error occurred during audio/video combination: ' + err.message);
                reject(err); // Reject the promise on error.
            })
            .run();
    });
}

// const filesToDelete = ['path/to/downloaded/video.mp4', 'path/to/another/file.png'];
// const directoriesToCleanup = ['path/to/generated/frames', 'path/to/processed/images'];
// cleanup(filesToDelete, directoriesToCleanup);

module.exports = {
    downloadVideo,
    extractFrames,
    recombineFramesToVideo,
    extractAudioFromVideo,
    combineAudioWithVideo,
};