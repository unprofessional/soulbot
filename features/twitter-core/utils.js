const formatTwitterDate = (twitterDate) => {

    console.log('>>>>> formatTwitterDate > twitterDate: ', twitterDate);

    const date = new Date(twitterDate);

    console.log('>>>>> formatTwitterDate > date: ', date);

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

    console.log('>>>>> formatTwitterDate > formattedTimeWithZone: ', formattedTimeWithZone);

    // Extract the time and the time zone abbreviation (e.g., "12:50 PM EST" or "12:50 PM EDT")
    const [formattedTime, meridiem, timeZoneAbbreviation] = formattedTimeWithZone.split(' ');

    console.log('>>>>> formatTwitterDate > formattedTime: ', formattedTime);
    console.log('>>>>> formatTwitterDate > meridiem: ', meridiem);
    console.log('>>>>> formatTwitterDate > timeZoneAbbreviation: ', timeZoneAbbreviation);

    // Map common abbreviations to user-friendly names
    const timeZoneNames = {
        EST: 'Eastern',
        EDT: 'Eastern',
    };

    const friendlyTimeZoneName = timeZoneNames[timeZoneAbbreviation] || timeZoneAbbreviation;

    console.log('>>>>> formatTwitterDate > friendlyTimeZoneName: ', friendlyTimeZoneName);

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

module.exports = {
    formatTwitterDate
};