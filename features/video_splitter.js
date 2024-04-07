const { Worker } = require('node:worker_threads');
const {
    readdirSync,
    existsSync,
} = require('node:fs');
const { 
    mkdir,
    readdir,
    stat,
    writeFile,
} = require('node:fs').promises
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const {
    downloadVideo,
    extractAudioFromVideo,
    combineAudioWithVideo,
} = require('../features/video-twitter/index.js');

const { buildPathsAndStuff } = require('../features/path_builder.js');
const { videoLogic } = require('./video-twitter/video_logic.js');

/**
 * FIXME - This is already declared in "downloadVideo()"
 * @param {*} videoUrl
 * @returns
 */
function checkVideoDuration(videoUrl) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoUrl, (err, metadata) => {
            if (err) {
                return reject(err);
            }
            const duration = metadata.format.duration;
            if (duration > 60) {
                return reject(new Error('>>>>> checkVideoDuration > Video duration exceeds 60 seconds.'));
            }
            resolve(duration);
        });
    });
}

function splitVideoIntoSegments(localVideoOutputPath, outputPattern, segmentDuration = 10) {
    return new Promise((resolve, reject) => {
        console.log('>>>>> splitVideoIntoSegments > localVideoOutputPath: ', localVideoOutputPath);
        console.log('>>>>> splitVideoIntoSegments > outputPattern: ', outputPattern);

        ffmpeg(localVideoOutputPath)
            .output(outputPattern)
            .outputOptions([
                `-segment_time ${segmentDuration}`, // Segment duration
                '-reset_timestamps 1', // Reset timestamps to start from 0 for each segment
                '-f segment', // Output format for segments
            ])
            .on('end', () => {
                console.log('>>> splitVideoIntoSegments > Video splitting completed.');
                resolve();
            })
            .on('error', (err) => {
                console.error('>>> splitVideoIntoSegments > An error occurred: ' + err);
                reject(err);
            })
            .run();
    });
}

async function processSegments(
    ctx,
    calculatedCanvasHeightFromDescLines,
    heightShim, mediaMaxHeight, mediaMaxWidth,
    canvas,
    segmentDir,
) {

    console.log('>>>>> processSegments > segmentDir: ', segmentDir);

    const files = readdirSync(segmentDir);
    const segmentFiles = files.filter(file => file.startsWith('segment_'));
    console.log('>>>>> processSegments > segmentFiles: ', segmentFiles);

    const segmentFilesPromises = segmentFiles.map(async file => {
        const filePath = path.join(segmentDir, file);
        console.log(`!!! Processing ${filePath}`);

        /** TODO
         * Process Each Segment in Parallel
         * After splitting, you can process each segment in parallel. For actual parallel processing,
         * you might use Node.js worker threads
         */

        // spawn worker thread
        await videoLogic(
            ctx,
            calculatedCanvasHeightFromDescLines,
            heightShim, mediaMaxHeight, mediaMaxWidth,
            canvas,
            filePath,
        );
    });

    return Promise.all(segmentFilesPromises);
}

/**
 * Execute the flow...
 */
async function executeVideoSplitAndProcessFlow(
    ctx,
    calculatedCanvasHeightFromDescLines,
    heightShim, mediaMaxHeight, mediaMaxWidth,
    canvas,
    videoUrl,
) {

    const processingDir = '/tempdata';
    // const segmentDirPattern = 'segment_%03d';
    const segmentPattern = 'segment_%03d.mp4';
    const pathObj = buildPathsAndStuff(processingDir, videoUrl);
    const localWorkingPath = pathObj.localWorkingPath;
    const localVideoOutputPath = pathObj.localVideoOutputPath;
    const localAudioPath = pathObj.localAudioPath;
    const localCompiledVideoOutputPath = pathObj.localCompiledVideoOutputPath;
    const recombinedFilePath = pathObj.recombinedFilePath;
    // const outputPattern = `${localWorkingPath}/${segmentDirPattern}/${segmentPattern}`; // Name pattern for output segments
    const outputPattern = `${localWorkingPath}/${segmentPattern}`; // Name pattern for output segments

    try {
        console.log('>>>>> executeVideoSplitAndProcessFlow > downloading video...');
        await downloadVideo(videoUrl, localVideoOutputPath);
        console.log('>>>>> executeVideoSplitAndProcessFlow > extracting audio...');
        await extractAudioFromVideo(localVideoOutputPath, localAudioPath);

        await checkVideoDuration(videoUrl);
        console.log('>>>>> executeVideoSplitAndProcessFlow > Video duration is within the allowed limit.');
        await splitVideoIntoSegments(localVideoOutputPath, outputPattern);

        return await processSegments(
            ctx,
            calculatedCanvasHeightFromDescLines,
            heightShim, mediaMaxHeight, mediaMaxWidth,
            canvas,
            localWorkingPath,
        );

        /**
         * Final steps
         */

        // TODO: Recombine Video Segments

        // const checkIfLocalAudioFileExists = async path => !!(await stat(localAudioPath).catch(e => false));
        // const localAudioFileExists = await checkIfLocalAudioFileExists();
        // let finalVideoFileExists = false;
        // console.log('>>>>> twitter_video_canvas > localAudioFileExists: ', localAudioFileExists);
        // if (localAudioFileExists) {
        //     console.log('>>>>> twitter_video_canvas > recombining audio with new video...');
        //     await combineAudioWithVideo(localCompiledVideoOutputPath, localAudioPath, recombinedFilePath);
        //     finalVideoFileExists = existsSync(recombinedFilePath);
        // } else {
        //     finalVideoFileExists = existsSync(localCompiledVideoOutputPath);
        // }

        // return new Promise((resolve, reject) => {
        //     try {
        //         if(finalVideoFileExists) {
        //             return resolve(localAudioFileExists ? recombinedFilePath : localCompiledVideoOutputPath);
        //         }
        //         else {
        //             return reject('File does not yet exist!');
        //         }
        //     }
        //     catch (err) {
        //         return reject(err);
        //     }
        //     // nothing else happens because all we're doing, when this is done, is reading the file we created from the calling side
        // });

    } catch (err) {
        console.log('>>>>> executeVideoSplitAndProcessFlow > Video splitting error: ', err);
    }
}

module.exports = {
    executeVideoSplitAndProcessFlow,
};
