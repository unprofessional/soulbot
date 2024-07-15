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
const { scaleDownToFitAspectRatio } = require('../twitter-post/scale_down');

const basePath = process.env.STORE_PATH;

/**
 * TODO: Refactor as utility file?
 * @param {*} filePath 
 * @returns 
 */
const ensureDirectoryExists = (filePath) => {
    const dirname = path.dirname(filePath); // TODO: we can use this for others
    if (existsSync(dirname)) {
        return true;
    }
    console.log('>>>>> ensureDirectoryExists > dirname: ', dirname);
    mkdirSync(`${dirname}/canvassed/`, { recursive: true });
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
    console.log('>>>>> downloadVideo > outputPath: ', outputPath);
    ensureDirectoryExists(outputPath);
    const response = await fetch(remoteFileUrl);
    console.log('>>>>> downloadVideo > fetching video from URL...');
    const fileStream = createWriteStream(outputPath);
    console.log('>>>>> downloadVideo > creating Write Stream as fileStream @ ', outputPath);
    // console.log('>>>>> downloadVideo > outputPath: ', outputPath);

    // Use response.body as an async iterator to read chunks
    for await (const chunk of response.body) {
        // console.log('!!! writing chunk to fileStream');
        fileStream.write(chunk);
    }
    fileStream.end(); // we MUST close the stream
    console.log('>>>>> fileStream write complete');
    
    return new Promise((resolve, reject) => {
        console.log('...promise handler...');

        fileStream.on('finish', async () => {
            console.log('fileStream finished! resolving!');
            console.log('>>>>> trying to read videoDuration...');
            const videoDuration = await getVideoDuration(outputPath); // try/catch?
            console.log('>>>>> videoDuration: ', videoDuration);
            if(videoDuration > 60) {
                console.log('video longer than 60 secs!');
                return resolve(false);
            } else {
                return resolve(true);
            }
        });
        fileStream.on('error', (err) => {
            console.log('fileStream error! rejecting! err: ', err);
            return reject(err);
        });
        // do we need a general on 'close' event capture?
    });
};

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
 * Extract frames from the video at one frame per second
 * Each frame is written to the local file system as a .png per second of frame...
 * @param {*} localVideoFilePath 
 * @param {*} frameRate 
 */
function extractFrames(localVideoFilePath, frameRate = 10) {

    console.log('>>>> extractFrames > localVideoFilePath: ', localVideoFilePath);

    const pathParts = localVideoFilePath.split('/');
    console.log('pathParts: ', pathParts);
    console.log('pathParts.length: ', pathParts.length);
    const filenameWithExtension = pathParts[pathParts.length - 1];
    const filenameParts = filenameWithExtension.split('.');
    const filename = filenameParts[0];
    console.log('filename: ', filename);
    const pathPartsWithoutFile = pathParts.splice(0, pathParts.length - 1);
    console.log('pathPartsWithoutFile: ', pathPartsWithoutFile);
    const path = pathPartsWithoutFile.join('/');
    console.log('path: ', path);
    const framesPathPattern = `${path}/${filename}_%03d.png`;
    console.log('framesPathPattern: ', framesPathPattern);

    return new Promise((resolve, reject) => {
        ffmpeg(localVideoFilePath)
            .output(framesPathPattern)
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
function recombineFramesToVideo(framesPattern, outputVideoPath, frameRate = 10) {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(framesPattern)
            .inputFPS(frameRate)
            .outputOptions(['-pix_fmt yuv420p']) // Specify the pixel format here
            .output(outputVideoPath)
            .size('560x?') // Set the video size to 1280x720
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

// Function to get video duration
function getVideoDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                const duration = metadata.format.duration;
                resolve(duration);
            }
        });
    });
}

function bakeImageAsFilterIntoVideo(
    videoInputPath, canvasInputPath, videoOutputPath,
    videoHeight, videoWidth,
    canvasHeight, canvasWidth, heightShim,
) {
    console.log('>>> bakeImageAsFilterIntoVideo > videoInputPath: ', videoInputPath);
    console.log('>>> bakeImageAsFilterIntoVideo > canvasInputPath: ', canvasInputPath);
    console.log('>>> bakeImageAsFilterIntoVideo > videoOutputPath: ', videoOutputPath);
    return new Promise((resolve, reject) => {
        // Check if input files exist
        if (!existsSync(videoInputPath)) {
            return reject(new Error(`Video input file does not exist: ${videoInputPath}`));
        }
        if (!existsSync(canvasInputPath)) {
            return reject(new Error(`Canvas input file does not exist: ${canvasInputPath}`));
        }

        /**
         * TODO: parameterize based on positioning logic in twitter_video_canvas
         */
        console.log('>>> bakeImageAsFilterIntoVideo > canvasHeight: ', canvasHeight);
        console.log('>>> bakeImageAsFilterIntoVideo > canvasWidth: ', canvasWidth);

        // Ensure the dimensions are even
        const adjustedCanvasWidth = Math.ceil(canvasWidth / 2) * 2;
        const adjustedCanvasHeight = Math.ceil(canvasHeight / 2) * 2;
        const adjustedVideoWidth = Math.ceil(videoWidth / 2) * 2;
        const adjustedVideoHeight = Math.ceil(videoHeight / 2) * 2;

        const mediaObject = {
            height: adjustedVideoHeight,
            width: adjustedVideoWidth
        };

        console.log('>>> bakeImageAsFilterIntoVideo > mediaObject: ', mediaObject);
        console.log('>>> bakeImageAsFilterIntoVideo > adjustedCanvasHeight: ', adjustedCanvasHeight);
        console.log('>>> bakeImageAsFilterIntoVideo > adjustedCanvasWidth: ', adjustedCanvasWidth);
        const scaledDownObject = scaleDownToFitAspectRatio(mediaObject, adjustedCanvasHeight, adjustedCanvasWidth, (canvasHeight - heightShim));
        console.log('>>> bakeImageAsFilterIntoVideo > scaledDownObject: ', scaledDownObject);

        /**
         * Determine overlay coordinates based on calculatedCanvasHeightFromDescLines?
         * maybe also heightShim
         */
        console.log('>>> bakeImageAsFilterIntoVideo > adjustedVideoWidth: ', adjustedVideoWidth);
        console.log('>>> bakeImageAsFilterIntoVideo > canvasWidth: ', canvasWidth);
        const overlayX = (canvasWidth - scaledDownObject.width) / 2;
        const overlayY = canvasHeight - heightShim - 50;
        console.log('>>> bakeImageAsFilterIntoVideo > overlayX: ', overlayX);
        console.log('>>> bakeImageAsFilterIntoVideo > overlayY: ', overlayY);

        ffmpeg()
            .input(canvasInputPath)
            .input(videoInputPath)
            .complexFilter([
                `[0:v]scale=${adjustedCanvasWidth}:${adjustedCanvasHeight}[frame]`,
                `[1:v]scale=${scaledDownObject.width}:${scaledDownObject.height}[video]`,
                `[frame][video]overlay=${overlayX}:${overlayY}[out]`
            ])
            .outputOptions([
                '-map [out]',
                '-map 1:a',
                '-c:v libx264',
                '-c:a copy'
            ])
            .on('start', commandLine => {
                console.log('@@@@@ Spawned FFmpeg with command: ' + commandLine);
            })
            // .on('stderr', stderrLine => {
            //     console.log('@@@@@ FFmpeg stderr: ' + stderrLine);
            // })
            .output(videoOutputPath)
            .on('end', function() {
                console.log('Overlay process completed.');
                const successFilePath = videoOutputPath;
                resolve(successFilePath); // Resolve the promise when the process is completed
            })
            .on('error', function(err) {
                console.error('An error occurred: ' + err.message);
                reject(err); // Reject the promise on error
            })
            .run();
    });
}

module.exports = {
    downloadVideo,
    extractAudioFromVideo,
    extractFrames,
    recombineFramesToVideo,
    combineAudioWithVideo,
    getVideoDuration,
    bakeImageAsFilterIntoVideo,
};
