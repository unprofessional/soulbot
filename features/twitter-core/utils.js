const crypto = require("crypto");

const formatTwitterDate = (twitterDate) => {

    // console.log('>>>>> formatTwitterDate > twitterDate: ', twitterDate);

    const date = new Date(twitterDate);

    // console.log('>>>>> formatTwitterDate > date: ', date);

    // Define the Eastern Time Zone
    const timeZone = 'America/New_York';

    // Format the time (e.g., "12:50 PM") with time zone information
    const twitterTimeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone,
        timeZoneName: 'short',
    });
    const formattedTimeWithZone = twitterTimeFormatter.format(date);

    // console.log('>>>>> formatTwitterDate > formattedTimeWithZone: ', formattedTimeWithZone);

    // Extract the time and the time zone abbreviation (e.g., "12:50 PM EST" or "12:50 PM EDT")
    const [formattedTime, meridiem, timeZoneAbbreviation] = formattedTimeWithZone.split(' ');

    // console.log('>>>>> formatTwitterDate > formattedTime: ', formattedTime);
    // console.log('>>>>> formatTwitterDate > meridiem: ', meridiem);
    // console.log('>>>>> formatTwitterDate > timeZoneAbbreviation: ', timeZoneAbbreviation);

    // Map common abbreviations to user-friendly names
    const timeZoneNames = {
        EST: 'Eastern',
        EDT: 'Eastern',
    };

    const friendlyTimeZoneName = timeZoneNames[timeZoneAbbreviation] || timeZoneAbbreviation;

    // console.log('>>>>> formatTwitterDate > friendlyTimeZoneName: ', friendlyTimeZoneName);

    // Format the date (e.g., "Nov 4, 2024") in Eastern Time
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
    });
    const formattedDate = dateFormatter.format(date);

    // Combine the formatted time, friendly time zone name, and date
    return `${formattedTime} ${meridiem} ${friendlyTimeZoneName} · ${formattedDate}`;
};

// Find number of associated media
const filterMediaUrls = (metadata, extensions) => {
    // console.log('!!! filterMediaUrls > metadata.mediaUrls: ', metadata.mediaUrls);
    return metadata.mediaUrls.filter((mediaUrl) => {
        // console.log('!!! filterMediaUrls > mediaUrl: ', mediaUrl);
        const mediaUrlParts = mediaUrl.split('.');
        // console.log('!!! filterMediaUrls > mediaUrlParts: ', mediaUrlParts);
        const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        // console.log('!!! filterMediaUrls > fileExtensionWithQueryParams: ', fileExtensionWithQueryParams);
        const fileExtension = fileExtensionWithQueryParams.split('?')[0];
        // console.log('!!! filterMediaUrls > fileExtension: ', fileExtension);
        // console.log('!!! ================================================');
        return extensions.includes(fileExtension);
    });
};

function getExtensionFromMediaUrl(mediaUrl) {
    if (typeof mediaUrl !== 'string') {
        console.warn('getExtensionFromMediaUrl received non-string input:', mediaUrl);
        return null;
    }
    const mediaUrlParts = mediaUrl.split('.');
    const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
    return fileExtensionWithQueryParams.split('?')[0];
}

const removeTCOLink = (text) => {
    if(!text) {
        return '';
    }
    const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/;
    const filteredText = text.replace(shortTwitterUrlPattern, '');
    return filteredText;
};

const stripQueryParams = (url) => {
    try {
        const urlOrigin = new URL(url).origin;
        console.log('>>>>> urlOrigin: ', urlOrigin);
        const urlPathname = new URL(url).pathname;
        console.log('>>>>> urlPathname: ', urlPathname);
        return urlOrigin + urlPathname;
    } catch (e) {
        return url; // Fallback for invalid URLs
    }
};

const randomNameGenerator = () => {
    // Word lists
    const adjectives = [
        "happy", "bold", "brave", "cool", "eager", "fierce", "gentle",
        "jolly", "keen", "lucky", "mighty", "noble", "quirky", "swift",
        "vibrant", "witty", "zealous"
    ];
    
    const nouns = [
        "turing", "curie", "einstein", "hawking", "newton", "tesla",
        "lovelace", "hopper", "fermat", "feynman", "bohr", "galileo",
        "kepler", "gauss", "noether", "darwin"
    ];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const uniqueId = crypto.randomBytes(2).toString("hex"); // 4-char hex

    return `${adjective}-${noun}-${uniqueId}`;
};

module.exports = {
    formatTwitterDate,
    filterMediaUrls,
    getExtensionFromMediaUrl,
    removeTCOLink,
    stripQueryParams,
    randomNameGenerator,
};

