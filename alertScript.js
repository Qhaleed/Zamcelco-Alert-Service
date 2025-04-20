// Facebook post checker for monitoring a target page
// Whenever the target Facebook page posts a new post, it will alert the user and get the header of the post

// Load environment variables from .env file
require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const notifier = require('node-notifier');

// Import the alternative checker
const { checkForNewPostsAlternative } = require('./alternativeChecker');

// Configuration using environment variables
const config = {
    // Facebook Graph API configuration
    facebookPageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN,

    // Check frequency in milliseconds
    checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS) || 15 * 60 * 1000,

    // Storage file for keeping track of seen posts
    storageFile: path.join(__dirname, 'seen_posts.json'),

    // Maximum number of posts to fetch on each check
    postsLimit: parseInt(process.env.POSTS_LIMIT) || 10
};

// Initialize or load the storage for seen posts
function initializeStorage() {
    if (!fs.existsSync(config.storageFile)) {
        fs.writeFileSync(config.storageFile, JSON.stringify({
            lastCheck: new Date().toISOString(),
            seenPosts: []
        }));
    }
    return JSON.parse(fs.readFileSync(config.storageFile, 'utf8'));
}

// Save storage data
function saveStorage(storageData) {
    fs.writeFileSync(config.storageFile, JSON.stringify(storageData, null, 2));
}

// Validate Facebook Access Token
async function validateAccessToken() {
    try {
        console.log('Validating Facebook access token...');
        const url = `https://graph.facebook.com/debug_token`;
        const params = {
            input_token: config.accessToken,
            access_token: config.accessToken
        };

        const response = await axios.get(url, { params });
        const tokenData = response.data.data;

        if (!tokenData.is_valid) {
            console.error('Facebook access token is invalid or expired.');
            console.error('Error:', tokenData.error?.message || 'Unknown error');
            return false;
        }

        console.log('Access token is valid. Expires:', tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toLocaleString() : 'Never');
        return true;
    } catch (error) {
        console.error('Error validating Facebook access token:', error.message);

        // Handle specific Facebook API errors
        if (error.response?.data?.error) {
            const fbError = error.response.data.error;
            console.error('Facebook API Error:', JSON.stringify(fbError, null, 2));

            // Feature Unavailable error
            if (fbError.message && fbError.message.includes('Feature Unavailable')) {
                console.error('\n================== FACEBOOK API RESTRICTION DETECTED ==================');
                console.error('You are encountering the "Feature Unavailable" error from Facebook.');
                console.error('This typically happens because:');
                console.error('1. You are using a developer token without a properly configured Facebook App');
                console.error('2. Your app may be in development mode and not fully approved by Facebook');
                console.error('3. Facebook has temporarily restricted this API functionality');
                console.error('\nPossible solutions:');
                console.error('Option 1: Use an alternative approach like RSS feeds or website scraping');
                console.error('Option 2: Create a proper Facebook App with the necessary permissions');
                console.error('Option 3: Contact the page owner to provide you with an approved access token');
                console.error('\nWould you like to switch to an alternative method? (Y/N)');
                console.error('===================================================================\n');
            }
        }

        console.error('Please check your access token and ensure it has the required permissions (pages_read_engagement).');
        console.error('Get a new access token at: https://developers.facebook.com/tools/explorer/');
        return false;
    }
}

// Fetch the latest posts from the Facebook page
async function fetchLatestPosts() {
    try {
        const url = `https://graph.facebook.com/${config.facebookPageId}/posts`;
        const params = {
            access_token: config.accessToken,
            limit: config.postsLimit,
            fields: 'id,message,created_time'
        };

        const response = await axios.get(url, { params });
        if (!response.data.data || response.data.data.length === 0) {
            console.log(`No posts found for page ID: ${config.facebookPageId}`);
        } else {
            console.log(`Successfully fetched ${response.data.data.length} posts.`);
        }
        return response.data.data || [];
    } catch (error) {
        console.error('Error fetching Facebook posts:', error.message);
        if (error.response) {
            console.error('API response:', error.response.data);

            // Handle specific error codes
            const fbError = error.response.data.error;
            const errorCode = fbError?.code;
            const errorMessage = fbError?.message || '';

            if (errorCode === 190) {
                console.error('\nYour access token is invalid or has expired.');
                console.error('Please get a new token at: https://developers.facebook.com/tools/explorer/');
                console.error('Make sure to request the "pages_read_engagement" permission.\n');
            } else if (errorCode === 100) {
                console.error('\nPage ID not found. Please check that you\'re using the correct Facebook Page ID.');
                console.error('You can find the Page ID by looking at the page URL or using online tools.\n');
            } else if (errorMessage.includes('Feature Unavailable')) {
                console.error('\n================== FACEBOOK API RESTRICTION DETECTED ==================');
                console.error('You are encountering the "Feature Unavailable" error from Facebook.');
                console.error('This typically happens because:');
                console.error('1. You are using a developer token without a properly configured Facebook App');
                console.error('2. Your app may be in development mode and not fully approved by Facebook');
                console.error('3. Facebook has implemented new API restrictions since April 2025');
                console.error('\nAlternative Solutions:');
                console.error('1. Use the RSS feed of the Facebook page if available');
                console.error('2. Implement a web scraper for the public Facebook page');
                console.error('3. Use a third-party service that provides Facebook page monitoring');
                console.error('\nWould you like me to implement one of these alternatives? Run the script');
                console.error('with the --alternative flag to use the alternative method:');
                console.error('node alertScript.js --alternative');
                console.error('===================================================================\n');
            }
        }
        return [];
    }
}

// Alternative method: Using web scraping to check Facebook posts
async function checkPostsAlternative() {
    console.log('\nUsing alternative method (Puppeteer web scraping) to check for new posts...');

    try {
        // Use the implementation from alternativeChecker.js
        return await checkForNewPostsAlternative(
            config.facebookPageId,
            config.storageFile,
            config.postsLimit
        );
    } catch (error) {
        console.error('Error using alternative method:', error.message);
        return [];
    }
}

// Extract the header (first line) from a post message
function extractHeader(message) {
    if (!message) return 'No message content';

    // Get the first line or first 100 characters if no line breaks
    const firstLine = message.split('\n')[0].trim();
    return firstLine.length > 100 ? `${firstLine.substring(0, 97)}...` : firstLine;
}

// Send notification for a new post
function notifyNewPost(post) {
    const header = extractHeader(post.message);
    console.log(`New post detected at ${post.created_time}`);
    console.log(`Header: ${header}`);

    // Desktop notification
    notifier.notify({
        title: 'New Facebook Post Detected',
        message: header,
        sound: true,
        wait: true
    });

    // You can add more notification methods here:
    // - Email notifications
    // - SMS notifications
    // - Push notifications to a mobile app
    // - Webhook integration
}

// Check for new posts and process them
async function checkForNewPosts(useAlternative = false) {
    console.log(`\nChecking for new posts at ${new Date().toLocaleString()}`);

    try {
        let posts = [];
        let newPosts = [];

        if (useAlternative) {
            // When using alternative method, it already handles storage
            newPosts = await checkPostsAlternative();

            if (newPosts.length > 0) {
                // Process new posts (newest first)
                newPosts
                    .sort((a, b) => new Date(b.created_time) - new Date(a.created_time))
                    .forEach(post => notifyNewPost(post));
            } else {
                console.log('No new posts found via alternative method');
            }

            return;
        }

        // Standard API method with storage handling
        const storage = initializeStorage();

        posts = await fetchLatestPosts();
        if (posts.length === 0) {
            console.log('No posts fetched or an error occurred');
            return;
        }

        // Find new posts that we haven't seen before
        newPosts = posts.filter(post => !storage.seenPosts.includes(post.id));

        if (newPosts.length > 0) {
            console.log(`Found ${newPosts.length} new posts!`);

            // Process new posts (newest first)
            newPosts
                .sort((a, b) => new Date(b.created_time) - new Date(a.created_time))
                .forEach(post => notifyNewPost(post));

            // Update storage with new post IDs
            storage.seenPosts = [
                ...newPosts.map(post => post.id),
                ...storage.seenPosts
            ].slice(0, 100); // Keep only the last 100 post IDs to avoid unlimited growth
        } else {
            console.log('No new posts found');
        }

        // Update the last check time
        storage.lastCheck = new Date().toISOString();
        saveStorage(storage);
    } catch (error) {
        console.error('Error in check process:', error);
    }
}

// Start the monitoring process
async function startMonitoring() {
    console.log('Facebook post checker starting...');

    // Check for alternative method flag
    const useAlternative = process.argv.includes('--alternative');

    if (useAlternative) {
        console.log('\nUsing alternative method (Puppeteer web scraping) for checking posts.');
        console.log('This method will work even when the Facebook API is unavailable.');
        console.log(`Target page: https://www.facebook.com/${config.facebookPageId}`);
        console.log(`Check interval: ${config.checkIntervalMs / (60 * 1000)} minutes`);

        // Do an initial check right away
        await checkForNewPosts(true);

        // Set up periodic checks
        setInterval(() => checkForNewPosts(true), config.checkIntervalMs);
        console.log(`\nMonitoring is now active. Checking every ${config.checkIntervalMs / (60 * 1000)} minutes.`);
        console.log('Press Ctrl+C to stop the program.');
        return;
    }

    // API method requires valid credentials
    if (!config.facebookPageId || !config.accessToken || config.accessToken === 'YOUR_VALID_FACEBOOK_TOKEN_HERE') {
        console.error('\nError: Missing or default environment variables.');
        console.error('Please update your .env file with the following:');
        console.error('1. FACEBOOK_PAGE_ID - ID of the Facebook page you want to monitor');
        console.error('2. FACEBOOK_ACCESS_TOKEN - A valid Facebook access token with pages_read_engagement permission');
        console.error('\nGet an access token at: https://developers.facebook.com/tools/explorer/');
        console.error('\nAlternatively, you can use the web scraping method:');
        console.error('node alertScript.js --alternative');
        process.exit(1);
    }

    // Validate the token
    const isTokenValid = await validateAccessToken();
    if (!isTokenValid) {
        console.error('\nWould you like to try the alternative method? Run:');
        console.error('node alertScript.js --alternative');
        process.exit(1);
    }

    console.log(`Target page ID: ${config.facebookPageId}`);
    console.log(`Check interval: ${config.checkIntervalMs / 1000} seconds (${config.checkIntervalMs / (60 * 1000)} minutes)`);

    // Do an initial check right away
    await checkForNewPosts();

    // Set up periodic checks
    setInterval(checkForNewPosts, config.checkIntervalMs);
    console.log(`\nMonitoring is now active. Checking every ${config.checkIntervalMs / (60 * 1000)} minutes.`);
    console.log('Press Ctrl+C to stop the program.');
}

// Main execution
if (require.main === module) {
    // Only run if this file is executed directly (not imported as a module)
    startMonitoring();
}

// Export functions for potential external use or testing
module.exports = {
    checkForNewPosts,
    fetchLatestPosts,
    extractHeader,
    notifyNewPost,
    validateAccessToken,
    checkPostsAlternative
};