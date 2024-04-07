const { existsSync } = require('node:fs');
const { 
    mkdir,
    readdir,
    stat,
    writeFile,
} = require('node:fs').promises
const { singleVideoFrame } = require('../image_gallery_rendering.js');
const { 
    downloadVideo,
    extractAudioFromVideo,
    extractFrames,
    recombineFramesToVideo,
    combineAudioWithVideo,
} = require('../video-twitter');
const { buildSegmentPathsAndStuff } = require('../path_builder.js');


const videoLogic = async (
    ctx,
    calculatedCanvasHeightFromDescLines,
    heightShim, mediaMaxHeight, mediaMaxWidth,
    canvas,
    videoSegmentPath,
    // pathObj,
) => {

    const videoSegmentPathParts = videoSegmentPath.split('/'); // i.e.  [ '', 'tempdata', 'vDn0W9g9SgNGVEcD', 'segment_001.mp4' ]
    console.log('>>>>> videoLogic > videoSegmentPathParts: ', videoSegmentPathParts);
    const workingPathPiece = videoSegmentPathParts[2]; // i.e, 'vDn0W9g9SgNGVEcD'
    console.log('>>>>> videoLogic > workingPathPiece: ', workingPathPiece);
    const processingDir = `/tempdata/${workingPathPiece}`; // i.e, '/tempdata/vDn0W9g9SgNGVEcD'
    const workingDir = 'canvassed';

    // console.log('>>>>> videoLogic > processingDir: ', processingDir);
    // console.log('>>>>> videoLogic > videoSegmentPath: ', videoSegmentPath);

    const pathObj = buildSegmentPathsAndStuff(processingDir, videoSegmentPath);
    console.log('>>>>> videoLogic > pathObj: ', pathObj);

    const localWorkingPath = pathObj.localWorkingPath;
    console.log('>>>>> videoLogic > localWorkingPath: ', localWorkingPath);
    const localVideoOutputPath = pathObj.localVideoOutputPath;
    const framesPattern = pathObj.framesPattern;
    const localCompiledVideoOutputPath = pathObj.localCompiledVideoOutputPath;

    // console.log('>>>>> videoLogic > localVideoOutputPath: ', localVideoOutputPath);

    console.log('>>>>> videoLogic > videoSegmentPath: ', videoSegmentPath);
    await extractFrames(videoSegmentPath);

    console.log('>>>>> videoLogic > compiling list of frames to work with...');
    const framesFilenamesUnfiltered = await readdir(localWorkingPath); // raw video frames, not yet canvassed
    const framesFilenames = framesFilenamesUnfiltered.filter((framepath) => {
        const framepathParts = framepath.split('.');
        return framepathParts[framepathParts.length - 1] === 'png';
    });

    console.log('>>>>> videoLogic > framesFilenames: ', framesFilenames);

    // TODO: account for the fact that we won't have height/width of the image
  
    // console.log('>>>>> videoLogic > creating directories if not exists...: ', `${localWorkingPath}/${workingDir}/`);
    await mkdir(`${localWorkingPath}/${workingDir}/`, { recursive: true }, (err) => {
        if (err) throw err;
    });

    console.log('>>>>> videoLogic > generating frames...');
    for (const frameFilename of framesFilenames) {
        const filenamePath = `${localWorkingPath}/${frameFilename}`;
        // console.log('!!! videoLogic > filenamePath: ', filenamePath);
  
        await singleVideoFrame(
            ctx,
            filenamePath,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth,
        );
        const canvasFilePath = `${localWorkingPath}/${workingDir}/${frameFilename}`;
        // console.log('>>>>> videoLogic > canvasFilePath: ', canvasFilePath);
        await writeFile(canvasFilePath, canvas.toBuffer('image/png'), { flag: 'w', encoding: 'utf8' });
    }

    console.log('>>>>> videoLogic > framesPattern: ', framesPattern);
    console.log('>>>>> videoLogic > localCompiledVideoOutputPath: ', localCompiledVideoOutputPath);
    console.log('>>>>> videoLogic > recombining canvassed frames into video...');
    await recombineFramesToVideo(framesPattern, localCompiledVideoOutputPath);

    console.log('>>>>> videoLogic > localCompiledVideoOutputPath: ', localCompiledVideoOutputPath);

    let finalVideoFileExists = false;
    finalVideoFileExists = existsSync(localCompiledVideoOutputPath);
    console.log('>>>>> videoLogic > finalVideoFileExists: ', finalVideoFileExists);

    return new Promise((resolve, reject) => {
        try {
            if(finalVideoFileExists) {
                return resolve(localCompiledVideoOutputPath);
            }
            else {
                return reject('File does not yet exist!');
            }
        }
        catch (err) {
            return reject(err);
        }
        // nothing else happens because all we're doing, when this is done, is reading the file we created from the calling side
    });
};

module.exports = {
    videoLogic
};
