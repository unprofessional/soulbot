const { createTwitterVideoCanvas } = require('../features/twitter-video/twitter_video_canvas.js');
const { buildPathsAndStuff } = require('../features/twitter-core/path_builder.js');

const { downloadVideo, bakeImageAsFilterIntoVideo } = require('../features/twitter-video/index.js');
const { renderTwitterPost } = require('../features/twitter-core/render_twitter_post.js');

const metadata1 = {
    "allSameType": true,
    "combinedMediaUrl": null,
    "communityNote": null,
    "conversationID": "1812297059166285945",
    "date": "Sun Jul 14 01:24:24 +0000 2024",
    "date_epoch": 1720920264,
    "hasMedia": true,
    "hashtags": [],
    "likes": 401,
    "mediaURLs": [
        "https://video.twimg.com/ext_tw_video/1812293315896717312/pu/vid/avc1/1280x720/HrRV80MAsfzsF1-m.mp4"
    ],
    "media_extended": [
        {
            "altText": null,
            "duration_millis": 35108,
            "size": {
                "height": 720,
                "width": 1280
            },
            "thumbnail_url": "https://pbs.twimg.com/ext_tw_video_thumb/1812293315896717312/pu/img/alICRWHrjRUdxPBR.jpg",
            "type": "video",
            "url": "https://video.twimg.com/ext_tw_video/1812293315896717312/pu/vid/avc1/1280x720/HrRV80MAsfzsF1-m.mp4"
        }
    ],
    "pollData": null,
    "possibly_sensitive": false,
    "qrt": null,
    "qrtURL": null,
    "replies": 26,
    "retweets": 98,
    "text": "JUST IN: Trump released from hospital after nearly being killed by attacker at Pennsylvania rally\n\n https://t.co/v4AoFJd2U4",
    "tweetID": "1812297059166285945",
    "tweetURL": "https://twitter.com/Breaking911/status/1812297059166285945",
    "user_name": "Breaking911",
    "user_profile_image_url": "https://pbs.twimg.com/profile_images/619546088995979264/KuG27bBK_normal.jpg",
    "user_screen_name": "Breaking911"
}

const metadata2 = {
    "allSameType": true,
    "combinedMediaUrl": null,
    "communityNote": null,
    "conversationID": "1812605187850473873",
    "date": "Sun Jul 14 21:48:48 +0000 2024",
    "date_epoch": 1720993728,
    "hasMedia": true,
    "hashtags": [],
    "likes": 200,
    "mediaURLs": [
        "https://video.twimg.com/amplify_video/1811507014272712704/vid/avc1/1080x1920/6JJPYb91DHm3uua_.mp4"
    ],
    "media_extended": [
        {
            "altText": null,
            "duration_millis": 43733,
            "size": {
                "height": 1920,
                "width": 1080
            },
            "thumbnail_url": "https://pbs.twimg.com/amplify_video_thumb/1811507014272712704/img/9ToBrjH9H7dXG7sR.jpg",
            "type": "video",
            "url": "https://video.twimg.com/amplify_video/1811507014272712704/vid/avc1/1080x1920/6JJPYb91DHm3uua_.mp4"
        }
    ],
    "pollData": null,
    "possibly_sensitive": false,
    "qrt": null,
    "qrtURL": null,
    "replies": 14,
    "retweets": 29,
    "text": "WATCH: Good Samaritans stop carjacking attempt in Los Angeles; the suspect was later arrested \n\nhttps://t.co/2LzMZpPCWX",
    "tweetID": "1812605187850473873",
    "tweetURL": "https://twitter.com/Breaking911/status/1812605187850473873",
    "user_name": "Breaking911",
    "user_profile_image_url": "https://pbs.twimg.com/profile_images/619546088995979264/KuG27bBK_normal.jpg",
    "user_screen_name": "Breaking911"
}

describe('twitter video canvas frame embedding and file output testing', () => {

    test('render landscape video', async () => {
        const videoUrl = metadata1.mediaURLs[0];

        const processingDir = '/tempdata';
        const pathObj = buildPathsAndStuff(processingDir, videoUrl);
        const filename = pathObj.filename;
        const localWorkingPath = pathObj.localWorkingPath;

        const videoInputPath = `${localWorkingPath}/${filename}.mp4`;
        const canvasInputPath = `${localWorkingPath}/${filename}.png`;
        const videoOutputPath = `${localWorkingPath}/${filename}-output.mp4`;

        const mediaObject = metadata1.media_extended[0].size;
        const videoHeight = mediaObject.height;
        const videoWidth = mediaObject.width;

        await downloadVideo(videoUrl, videoInputPath);
        const { canvasHeight, canvasWidth, heightShim }  = await createTwitterVideoCanvas(metadata1);
        console.log('>>>>> send metadata TEST > canvasHeight: ', canvasHeight);
        console.log('>>>>> send metadata TEST > canvasWidth: ', canvasWidth);
        // console.log('>>>>> send metadata TEST > recombinedFilePath: ', recombinedFilePath);

        // const originalVideoFileExists = existsSync(localVideoOutputPath);
        // expect(originalVideoFileExists).toBe(true);
        // const finalVideoFileExists = existsSync(recombinedFilePath);
        // expect(finalVideoFileExists).toBe(true);

        await bakeImageAsFilterIntoVideo(
            videoInputPath, canvasInputPath, videoOutputPath,
            videoHeight, videoWidth,
            canvasHeight, canvasWidth, heightShim,
        );
        // await cleanup([], [localWorkingPath]);
        
    }, 60000); // give it one full minute to test...

    // test('render portrait video', async () => {
    //     const videoUrl = metadata2.mediaURLs[0];

    //     const processingDir = '/tempdata';
    //     const pathObj = buildPathsAndStuff(processingDir, videoUrl);
    //     const filename = pathObj.filename;
    //     const localWorkingPath = pathObj.localWorkingPath;

    //     const videoInputPath = `${localWorkingPath}/${filename}.mp4`;
    //     const canvasInputPath = `${localWorkingPath}/${filename}.png`;
    //     const videoOutputPath = `${localWorkingPath}/${filename}-output.mp4`;

    //     const mediaObject = metadata2.media_extended[0].size;
    //     const videoHeight = mediaObject.height;
    //     const videoWidth = mediaObject.width;

    //     await downloadVideo(videoUrl, videoInputPath);
    //     const { canvasHeight, canvasWidth, heightShim }  = await createTwitterVideoCanvas(metadata2);
    //     console.log('>>>>> send metadata TEST > canvasHeight: ', canvasHeight);
    //     console.log('>>>>> send metadata TEST > canvasWidth: ', canvasWidth);
    //     // console.log('>>>>> send metadata TEST > recombinedFilePath: ', recombinedFilePath);

    //     // const originalVideoFileExists = existsSync(localVideoOutputPath);
    //     // expect(originalVideoFileExists).toBe(true);
    //     // const finalVideoFileExists = existsSync(recombinedFilePath);
    //     // expect(finalVideoFileExists).toBe(true);

    //     await bakeImageAsFilterIntoVideo(
    //         videoInputPath, canvasInputPath, videoOutputPath,
    //         videoHeight, videoWidth,
    //         canvasHeight, canvasWidth, heightShim,
    //     );
    //     // await cleanup([], [localWorkingPath]);
        
    // }, 60000); // give it one full minute to test...

    // test('render_twitter_post fn call for landscape video', async () => {
        
    //     await renderTwitterPost(
    //         metadata1,
    //         { reply: () => {} },
    //     );
        
    // }, 60000); // give it one full minute to test...

    // test('render_twitter_post fn call for portrait video', async () => {
        
    //     await renderTwitterPost(
    //         metadata2,
    //         { reply: () => {} },
    //     );
        
    // }, 60000); // give it one full minute to test...

});
