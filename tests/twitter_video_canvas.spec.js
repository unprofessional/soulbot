const { existsSync } = require('node:fs');
// const { stat } = require('node:fs').promises;
const { cleanup } = require('../features/video-twitter/cleanup.js');
const { createTwitterVideoCanvas } = require('../features/twitter_video_canvas.js');

const metadata = {
    "communityNote": null,
    "conversationID": "1759422005991063570",
    "date": "Mon Feb 19 03:37:49 +0000 2024",
    "date_epoch": 1708313869,
    "hashtags": [],
    "likes": 137,
    "mediaURLs": [
        "https://video.twimg.com/ext_tw_video/1759421971660705792/pu/vid/avc1/888x640/vDn0W9g9SgNGVEcD.mp4?tag=12"
    ],
    "media_extended": [
        {
            "altText": null,
            "duration_millis": 17085,
            "size": {
                "height": 640,
                "width": 888
            },
            "thumbnail_url": "https://pbs.twimg.com/ext_tw_video_thumb/1759421971660705792/pu/img/9e1Vn9fGt8_eOB2E.jpg",
            "type": "video",
            "url": "https://video.twimg.com/ext_tw_video/1759421971660705792/pu/vid/avc1/888x640/vDn0W9g9SgNGVEcD.mp4?tag=12"
        }
    ],
    "possibly_sensitive": false,
    "qrtURL": null,
    "replies": 4,
    "retweets": 26,
    "text": "cultural and political discourse has been reduced to this https://t.co/H0fqSh94B1",
    "tweetID": "1759422005991063570",
    "tweetURL": "https://twitter.com/hansvanharken/status/1759422005991063570",
    "user_name": "Hans Van Harken",
    "user_profile_image_url": "https://pbs.twimg.com/profile_images/1686508177565904896/YmgfubiL_normal.jpg",
    "user_screen_name": "hansvanharken"
};

const processingDir = 'ffmpeg';
// const workingDir = 'canvassed';

const mediaUrl = metadata.mediaURLs[0];
const mediaUrlParts = mediaUrl.split('/');
const filenameWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
const filenameWithQueryParamsParts = filenameWithQueryParams.split('?');
const originalVideoFilename = filenameWithQueryParamsParts[0];

const filenameParts = originalVideoFilename.split('.');
const filename = filenameParts[0]; // grab filename/fileID without extension
const localWorkingPath = `${processingDir}/${filename}`; // filename is the directory here for uniqueness
const localVideoOutputPath = `${localWorkingPath}/${originalVideoFilename}`;
// const localAudioPath = `${localWorkingPath}/${filename}.mp3`;

// const framesPattern = `${localWorkingPath}/${workingDir}/${filename}_%03d.png`;
// const localCompiledVideoOutputPath = `${localWorkingPath}/finished-${originalVideoFilename}`;
const recombinedFilePath = `${localWorkingPath}/recombined-av-${originalVideoFilename}`;


describe('twitter video canvas frame embedding and file output testing', () => {
    test('send metadata into the canvas', async () => {
        await createTwitterVideoCanvas(metadata);

        console.log('>>>>> send metadata TEST > localVideoOutputPath: ', localVideoOutputPath);
        console.log('>>>>> send metadata TEST > recombinedFilePath: ', recombinedFilePath);

        const originalVideoFileExists = existsSync(localVideoOutputPath);
        expect(originalVideoFileExists).toBe(true);
        const finalVideoFileExists = existsSync(recombinedFilePath);
        expect(finalVideoFileExists).toBe(true);

        // await cleanup([], [localWorkingPath]);
    }, 60000); // give it one full minute to test...
});
