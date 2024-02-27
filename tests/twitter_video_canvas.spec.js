const { existsSync } = require('node:fs');
const { stat } = require('node:fs').promises;
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

const mediaUrl = metadata.mediaURLs[0];
const mediaUrlParts = mediaUrl.split('/');
const filenameWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
const filenameWithQueryParamsParts = filenameWithQueryParams.split('?');
const originalVideoFilename = filenameWithQueryParamsParts[0];
console.log('>>>>> twitter_video_canvas TEST > originalVideoFilename: ', originalVideoFilename);
const finalVideoFilename = `recombined-av-${originalVideoFilename}`;
console.log('>>>>> twitter_video_canvas TEST > finalVideoFilename: ', finalVideoFilename);

describe('twitter video canvas frame embedding and file output testing', () => {
    test('send metadata into the canvas', async () => {
        await createTwitterVideoCanvas(metadata);

        const originalVideoFileExists = existsSync(`ffmpeg/${originalVideoFilename}`);
        expect(originalVideoFileExists).toBe(true);
        const finalVideoFileExists = existsSync(`ffmpeg/${finalVideoFilename}`);
        expect(finalVideoFileExists).toBe(true);

        // const originalVideoFileExists = async path => !!(await stat(path).catch(e => false));
        // await originalVideoFileExists();
        // expect(originalVideoFileExists).toBe(true);
        // const finalVideoFileExists = async path => !!(await stat(path).catch(e => false));
        // await finalVideoFileExists();
        // expect(finalVideoFileExists).toBe(true);

        await cleanup([`ffmpeg/${originalVideoFilename}`], ['ffmpeg', 'ffmpeg/canvassed']);
    }, 60000); // give it one full minute to test...
});
