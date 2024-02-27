const { existsSync } = require('node:fs');
const {
    downloadVideo,
    extractFrames,
    recombineFramesToVideo,
    extractAudioFromVideo,
    combineAudioWithVideo,
} = require('../features/video-twitter/index.js');
const { cleanup } = require('../features/video-twitter/cleanup.js');

const testVideoUrl = "https://video.twimg.com/ext_tw_video/1759421971660705792/pu/vid/avc1/888x640/vDn0W9g9SgNGVEcD.mp4?tag=12";
const processingDir = 'ffmpeg';
const workingDir = 'canvassed';
const testDir = 'test';
const testFile = 'testvideo.mp4';
const localOutputPath = `${processingDir}/${testDir}/${testFile}`;
const localCompiledVideoOutputPath = `${processingDir}/${testDir}/finished-${testFile}`;
const testAudioFile = 'testaudio.mp3';
const localAudioPath = `${processingDir}/${testDir}/${testAudioFile}`;
const recombinedFilePath = `${processingDir}/${testDir}/recombined-av-${testFile}`;

describe('initial video loading', () => {

    test('file write', async () => {
        await downloadVideo(testVideoUrl, localOutputPath);
        // Check if the file exists
        const fileExists = existsSync(localOutputPath);
        console.log('>>>>> test > file written > fileExists: ', fileExists);
        expect(fileExists).toBe(true);
    }, 5000);

    test('extracting frames and write', async () => {
        const pathParts = localOutputPath.split('/');
        const filenameWithExtension = pathParts[pathParts.length - 1];
        const filenameParts = filenameWithExtension.split('.');
        const filename = filenameParts[0];

        const pathPartsWithoutFile = pathParts.splice(0, pathParts.length - 1);
        const path = pathPartsWithoutFile.join('/');
        const firstFrameOutput = `${path}/${filename}_001.png`;
        console.log('>>>>> test > extracting frame > firstFrameOutput: ', firstFrameOutput);

        const fileExists = existsSync(localOutputPath);
        console.log('>>>>> test > extracting frame > fileExists: ', fileExists);
        expect(fileExists).toBe(true);
        await extractFrames(localOutputPath);
        const firstFrameExists = existsSync(firstFrameOutput);
        console.log('>>>>> test > extracting frame > firstFrameExists: ', firstFrameExists);
        expect(firstFrameExists).toBe(true);
    });

    test('recombine frames to video', async () => {
        const pathParts = localOutputPath.split('/');
        const filenameWithExtension = pathParts[pathParts.length - 1];
        const filenameParts = filenameWithExtension.split('.');
        const filename = filenameParts[0];
        const pathPartsWithoutFile = pathParts.splice(0, pathParts.length - 1);
        const path = pathPartsWithoutFile.join('/');
        const framesPattern = `${path}/${filename}_%03d.png`;

        const fileExists = existsSync(localOutputPath);
        console.log('>>>>> test > recombine frame > fileExists: ', fileExists);
        expect(fileExists).toBe(true);
        await recombineFramesToVideo(framesPattern, localCompiledVideoOutputPath);
        const outputVideoExists = existsSync(localCompiledVideoOutputPath);
        console.log('>>>>> test > recombine frame > outputVideoExists: ', outputVideoExists);
        expect(outputVideoExists).toBe(true);
    });

    test('extracting audio', async () => {
        const fileExists = existsSync(localOutputPath);
        console.log('>>>>> test > extracting audio > fileExists: ', fileExists);
        expect(fileExists).toBe(true);
        await extractAudioFromVideo(localOutputPath, localAudioPath);
        const audioFileExists = existsSync(localAudioPath);
        console.log('>>>>> test > extracting audio > audioFileExists: ', audioFileExists);
        expect(audioFileExists).toBe(true);
    });

    test('combine audio + video', async () => {
        const videoFileExists = existsSync(localCompiledVideoOutputPath);
        const audioFileExists = existsSync(localAudioPath);
        console.log('>>>>> test > extracting audio > videoFileExists: ', videoFileExists);
        console.log('>>>>> test > extracting audio > audioFileExists: ', audioFileExists);
        expect(videoFileExists).toBe(true);
        expect(audioFileExists).toBe(true);

        await combineAudioWithVideo(localCompiledVideoOutputPath, localAudioPath, recombinedFilePath);

        const recombinedFileExists = existsSync(recombinedFilePath);
        expect(recombinedFileExists).toBe(true);
    });

    test('file cleanup', async () => {
        await cleanup([], [`${processingDir}/${testDir}`]);
        const fileExists = existsSync(localOutputPath);
        console.log('>>>>> test > cleanup > fileExists: ', fileExists);
        expect(fileExists).toBe(false);
    });
});
