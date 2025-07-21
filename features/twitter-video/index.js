// features/twitter-video/index.js

const path = require('node:path');
// const {
//     constants,
//     // writeFile,
// } = require('node:fs').promises;
const {
    // createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
} = require('node:fs');
// https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
var ffmpeg = require('fluent-ffmpeg');
// const { scaleDownToFitAspectRatio } = require('../twitter-post/scale_down');
const { getAdjustedAspectRatios } = require('../twitter-core/canvas_utils');

// const basePath = process.env.STORE_PATH;

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
    // console.log('>>>>> ensureDirectoryExists > dirname: ', dirname);
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
    // console.log('>>>>> downloadVideo > outputPath: ', outputPath);
    ensureDirectoryExists(outputPath);
    const response = await fetch(remoteFileUrl);
    // console.log('>>>>> downloadVideo > fetching video from URL...');
    const fileStream = createWriteStream(outputPath);
    // console.log('>>>>> downloadVideo > creating Write Stream as fileStream @ ', outputPath);
    // console.log('>>>>> downloadVideo > outputPath: ', outputPath);

    // Use response.body as an async iterator to read chunks
    for await (const chunk of response.body) {
        // console.log('!!! writing chunk to fileStream');
        fileStream.write(chunk);
    }
    fileStream.end(); // we MUST close the stream
    // console.log('>>>>> fileStream write complete');
    
    return new Promise((resolve, reject) => {
        // console.log('...promise handler...');

        fileStream.on('finish', async () => {
            // console.log('fileStream finished! resolving!');
            // console.log('>>>>> trying to read videoDuration...');
            const videoDuration = await getVideoDuration(outputPath); // try/catch?
            // console.log('>>>>> videoDuration: ', videoDuration);
            if(videoDuration > 60) {
                console.log('video longer than 60 secs!');
                return resolve(false);
            } else {
                return resolve(true);
            }
        });
        fileStream.on('error', (err) => {
            console.error('fileStream error! rejecting! err: ', err);
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

// Function to get video file size
function getVideoFileSize(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                const fileSize = metadata.format.size;
                resolve(fileSize);
            }
        });
    });
}

// const applyRoundedCornersToVideo = (inputVideo, maskImage, outputVideo) => {
//     return new Promise((resolve, reject) => {
//         ffmpeg()
//             .input(inputVideo) // Input video
//             .input(maskImage)  // Input mask
//             .complexFilter([
//                 // Extract alpha from the mask
//                 '[1:v]format=rgba,alphaextract[maskalpha]',
//                 // Merge the mask with the video
//                 '[0:v][maskalpha]alphamerge[roundedvideo]',
//                 // Output the final video
//                 '[roundedvideo]format=yuv420p[out]'
//             ])
//             .outputOptions(['-map [out]', '-c:v libx264', '-crf 23'])
//             .output(outputVideo)
//             .on('start', (command) => {
//                 console.log(`FFmpeg started with command: ${command}`);
//             })
//             .on('end', () => {
//                 console.log('Rounded corners applied successfully.');
//                 resolve();
//             })
//             .on('error', (err) => {
//                 console.error('Error applying rounded corners:', err.message);
//                 reject(err);
//             })
//             .run();
//     });
// };

function bakeImageAsFilterIntoVideo(
    videoInputPath, canvasInputPath, videoOutputPath,
    videoHeight, videoWidth,
    canvasHeight, canvasWidth, heightShim,
) {
    return new Promise((resolve, reject) => {
        // Check if input files exist
        if (!existsSync(videoInputPath)) {
            return reject(new Error(`Video input file does not exist: ${videoInputPath}`));
        }
        if (!existsSync(canvasInputPath)) {
            return reject(new Error(`Canvas input file does not exist: ${canvasInputPath}`));
        }

        const {
            adjustedCanvasWidth, adjustedCanvasHeight,
            scaledDownObjectWidth, scaledDownObjectHeight,
            overlayX, overlayY
        } = getAdjustedAspectRatios(
            canvasWidth, canvasHeight,
            videoWidth, videoHeight,
            heightShim
        );

        // Check if video has an audio stream
        ffmpeg.ffprobe(videoInputPath, (err, metadata) => {
            if (err) {
                return reject(new Error(`Failed to probe video: ${err.message}`));
            }

            const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
            // console.log('>>> bakeImageAsFilterIntoVideo > hasAudio: ', hasAudio);

            // console.log(`>>>>> bakeImageAsFilterIntoVideo > adjustedCanvasWidth:adjustedCanvasHeight: ${adjustedCanvasWidth}:${adjustedCanvasHeight}`);
            // console.log(`>>>>> bakeImageAsFilterIntoVideo > scaledDownObject.width:scaledDownObject.height: ${scaledDownObjectWidth}:${scaledDownObjectHeight}`);

            // const videoAspectRatio = videoWidth / videoHeight;
            // const canvasAspectRatio = canvasWidth / canvasHeight;
            // console.log('>>>>> bakeImageAsFilterIntoVideo > Video Aspect Ratio:', videoAspectRatio);
            // console.log('>>>>> bakeImageAsFilterIntoVideo > Canvas Aspect Ratio:', canvasAspectRatio);
            
            // const adjustedVideoAspectRatio = adjustedCanvasWidth / adjustedCanvasHeight;
            // const adjustedCanvasAspectRatio = adjustedCanvasWidth / adjustedCanvasHeight;
            // console.log('>>>>> bakeImageAsFilterIntoVideo > Adjusted Video Aspect Ratio:', adjustedVideoAspectRatio);
            // console.log('>>>>> bakeImageAsFilterIntoVideo > Adjusted Canvas Aspect Ratio:', adjustedCanvasAspectRatio);

            const widthPadding  = 40; // This is possibly what's screwing us up with the "squish" effect
            const command = ffmpeg()
                .input(canvasInputPath)
                .input(videoInputPath)
                .complexFilter([
                    `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight}[frame]`,
                    `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight}[video]`,
                    `[frame][video]overlay=${overlayX + widthPadding/2}:${overlayY}[out]`
                ])
                .outputOptions(['-c:v libx264', '-map [out]']);
                // .complexFilter([
                //     `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight}[frame]`,
                //     // Scale video to fit within the canvas placeholder
                //     `[1:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight}[scaledvideo]`,
                //     // Overlay the canvas on top of the video
                //     `[scaledvideo][frame]overlay=${overlayX + widthPadding/2}:${overlayY}[out]`
                // ])
                // .outputOptions(['-map [out]', '-c:v libx264', '-crf 23'])

            if (hasAudio) {
                command.outputOptions(['-map 1:a', '-c:a copy']);
            }

            command.output(videoOutputPath)
                .on('start', commandLine => {
                    console.log('@@@@@ Spawned FFmpeg with command: ' + commandLine);
                })
                // .on('stderr', stderrLine => {
                //     console.log('@@@@@ FFmpeg stderr: ' + stderrLine);
                // })
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
    });
}

/**
 * GPU Acceleration attempt...
 */
// function bakeImageAsFilterIntoVideo(
//     videoInputPath, canvasInputPath, videoOutputPath,
//     videoHeight, videoWidth,
//     canvasHeight, canvasWidth, heightShim,
// ) {
//     return new Promise((resolve, reject) => {
//         // Check if input files exist
//         if (!existsSync(videoInputPath)) {
//             return reject(new Error(`Video input file does not exist: ${videoInputPath}`));
//         }
//         if (!existsSync(canvasInputPath)) {
//             return reject(new Error(`Canvas input file does not exist: ${canvasInputPath}`));
//         }

//         const {
//             adjustedCanvasWidth, adjustedCanvasHeight,
//             scaledDownObjectWidth, scaledDownObjectHeight,
//             overlayX, overlayY
//         } = getAdjustedAspectRatios(
//             canvasWidth, canvasHeight,
//             videoWidth, videoHeight,
//             heightShim
//         );

//         // Check if video has an audio stream
//         ffmpeg.ffprobe(videoInputPath, (err, metadata) => {
//             if (err) {
//                 return reject(new Error(`Failed to probe video: ${err.message}`));
//             }

//             const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');

//             const widthPadding  = 40; // This is possibly what's screwing us up with the "squish" effect
//             const command = ffmpeg()
//                 .input(canvasInputPath)
//                 .input(videoInputPath)
//                 .complexFilter([
//                     `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight}[frame]`,
//                     `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight}[video]`,
//                     `[frame][video]overlay=${overlayX + widthPadding/2}:${overlayY}[out]`
//                 ])
//                 // Use NVIDIA's NVENC for encoding
//                 .outputOptions(['-c:v h264_nvenc', '-preset fast', '-map [out]']);

//             if (hasAudio) {
//                 command.outputOptions(['-map 1:a', '-c:a copy']);
//             }

//             command.output(videoOutputPath)
//                 .on('start', commandLine => {
//                     console.log('@@@@@ Spawned FFmpeg with command: ' + commandLine);
//                 })
//                 .on('end', function() {
//                     console.log('Overlay process completed.');
//                     const successFilePath = videoOutputPath;
//                     resolve(successFilePath); // Resolve the promise when the process is completed
//                 })
//                 .on('error', function(err) {
//                     console.error('An error occurred: ' + err.message);
//                     reject(err); // Reject the promise on error
//                 })
//                 .run();
//         });
//     });
// }

module.exports = {
    downloadVideo,
    extractAudioFromVideo,
    extractFrames,
    recombineFramesToVideo,
    combineAudioWithVideo,
    getVideoDuration,
    getVideoFileSize,
    bakeImageAsFilterIntoVideo,
};
