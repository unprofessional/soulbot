const puppeteer = require(`puppeteer`);

const renderTwitterPost = async (message, twitterPostUrl) => {
    const tweetData = await scrapeTweetData(twitterPostUrl);
    console.log('>>>>> tweetData: ', tweetData);
    message.channel.send('tweetData: ', tweetData);
    // const image = await renderTweetToImage(tweetData);
}

const scrapeTweetData = async (url) => {
    // Launch the headless browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate to the Twitter post URL
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Set screen size
    await page.setViewport({width: 1080, height: 1024});

    // Wait for the tweet content to load
    // (You might need to adjust the selector based on Twitter's current layout)
    await page.waitForSelector('article'); 

    // Extract tweet data
    const tweetData = await page.evaluate(() => {
        const article = document.querySelector('article');
      
        // Extract text content
        const textContent = article.querySelector('div[lang]').innerText;

        // Extract other elements as needed, e.g., images, user info, etc.
        // You would use article.querySelector or article.querySelectorAll
        // with the appropriate selectors for these elements

        return {
            text: textContent
            // Include other extracted data here
        };
    });

    // Close the browser
    await browser.close();

    return tweetData;
}

const renderTweetToImage = async (tweetData) => {
    // Use node-canvas to draw the tweet onto a canvas
    // Convert canvas to an image and return
}

module.exports = { renderTwitterPost }
