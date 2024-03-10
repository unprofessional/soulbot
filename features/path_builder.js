const extractFilename = (videoUrl) => {
    const videoUrlParts = videoUrl.split('/');
    console.log('>>>>> pathBuilder > extractFilename > videoUrlParts: ', videoUrlParts);
    const filenameQueryParamParts = videoUrlParts[videoUrlParts.length - 1].split('?');
    console.log('>>>>> pathBuilder > extractFilename > filenameQueryParamParts: ', filenameQueryParamParts);
    const filename = filenameQueryParamParts[0];
    console.log('>>>>> pathBuilder > extractFilename > filename: ', filename);
    return filename;
};

const buildPathsAndStuff = (processingDir = '/tempdata', videoUrl) => {
    const sourceVideoFilename = extractFilename(videoUrl);
    // building blocks, not useful on their own
    const workingDir = 'canvassed';
    const filenameParts = sourceVideoFilename.split('.');
    // useful
    const filename = filenameParts[0]; // grab filename/fileID without extension
    console.log('>>>>> pathBuilder > extractFilename > filename: ', filename);
    const localWorkingPath = `${processingDir}/${filename}`; // filename is the directory here for uniqueness
    console.log('>>>>> pathBuilder > extractFilename > localWorkingPath: ', localWorkingPath);
    const localVideoOutputPath = `${localWorkingPath}/${sourceVideoFilename}`;
    console.log('>>>>> pathBuilder > extractFilename > localVideoOutputPath: ', localVideoOutputPath);
    const localAudioPath = `${localWorkingPath}/${filename}.mp3`;
    console.log('>>>>> pathBuilder > extractFilename > localAudioPath: ', localAudioPath);
    const framesPattern = `${localWorkingPath}/${workingDir}/${filename}_%03d.png`;
    console.log('>>>>> pathBuilder > extractFilename > framesPattern: ', framesPattern);
    const localCompiledVideoOutputPath = `${localWorkingPath}/finished-${sourceVideoFilename}`;
    console.log('>>>>> pathBuilder > extractFilename > localCompiledVideoOutputPath: ', localCompiledVideoOutputPath);
    const recombinedFilePath = `${localWorkingPath}/recombined-av-${sourceVideoFilename}`;
    console.log('>>>>> pathBuilder > extractFilename > recombinedFilePath: ', recombinedFilePath);

    return {
        filename,
        localWorkingPath,
        localVideoOutputPath,
        localAudioPath,
        framesPattern,
        localCompiledVideoOutputPath,
        recombinedFilePath,
    };
};

module.exports = {
    buildPathsAndStuff,
};
