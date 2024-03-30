const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

function checkVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const duration = metadata.format.duration;
      if (duration > 60) {
        return reject(new Error("Video duration exceeds 60 seconds."));
      }
      resolve(duration);
    });
  });
}

function splitVideoIntoSegments(filePath, segmentDuration = 10) {
  return new Promise((resolve, reject) => {
    const outputPattern = 'segment_%03d.mp4'; // Name pattern for output segments
    ffmpeg(filePath)
      .output(outputPattern)
      .outputOptions([
        `-segment_time ${segmentDuration}`, // Segment duration
        '-reset_timestamps 1', // Reset timestamps to start from 0 for each segment
        '-f segment', // Output format for segments
      ])
      .on('end', () => {
        console.log('Video splitting completed.');
        resolve();
      })
      .on('error', (err) => {
        console.error('An error occurred: ' + err.message);
        reject(err);
      })
      .run();
  });
}

function processSegments(segmentDir) {
  const files = fs.readdirSync(segmentDir);
  const segmentFiles = files.filter(file => file.startsWith('segment_'));
  segmentFiles.forEach(file => {
    const filePath = path.join(segmentDir, file);
    console.log(`Processing ${filePath}`);

    /** TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO 
     * Process Each Segment in Parallel
     * After splitting, you can process each segment in parallel. For actual parallel processing,
     * you might use Node.js worker threads or child processes. However, the example below will
     * simply log the processing of each segment for illustration:
     */
    
  });
}

/**
 * Execute the flow...
 */
export function executeVideoSplitAndProcessFlow(videoPath) {
  checkVideoDuration(videoPath)
  .then(() => {
    console.log('Video duration is within the allowed limit.');
    return splitVideoIntoSegments(videoPath);
  })
  .then(() => {
    console.log('Splitting completed. Processing segments...');
    processSegments('path/to/segments/');
  })
  .catch(error => {
    console.error('An error occurred:', error);
  });
}
