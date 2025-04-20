/**
 * Alternative Facebook Post Checker
 * 
 * This module provides an alternative way to check for new Facebook posts
 * when the official Graph API is unavailable or restricted.
 * It uses Puppeteer to scrape the public Facebook page.
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/**
 * Scrape Facebook posts from a public page
 * @param {string} pageId - Facebook page ID or username
 * @param {number} postsLimit - Maximum number of posts to fetch
 * @returns {Promise<Array>} - Array of post objects with id, message, and created_time
 */
async function scrapePagePosts(pageId, postsLimit = 5) {
    console.log(`Starting Facebook scraper for page: ${pageId}`);

    // Launch browser in headless mode
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications']
    });

    try {
        const page = await browser.newPage();

        // Set viewport and user agent to mimic a real browser
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // Navigate to the Facebook page
        const url = `https://www.facebook.com/${pageId}`;
        console.log(`Navigating to ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Check if we need to dismiss any dialogs (like cookie notices)
        try {
            // Wait for and click potential cookie consent button
            await page.waitForSelector('[data-cookiebanner="accept_button"]', { timeout: 5000 });
            await page.click('[data-cookiebanner="accept_button"]');
            console.log('Dismissed cookie consent dialog');
        } catch (e) {
            // Cookie dialog may not appear - that's fine
        }

        // Wait for posts to load
        console.log('Waiting for posts to load...');
        await page.waitForSelector('div[role="article"]', { timeout: 30000 });

        // Scroll down a few times to load more posts
        console.log('Scrolling to load more posts...');
        for (let i = 0; i < Math.min(postsLimit, 5); i++) {
            await page.evaluate(() => {
                window.scrollBy(0, 1000);
            });
            // Wait a bit between scrolls
            await page.waitForTimeout(1000);
        }

        // Get page content and parse with Cheerio
        const content = await page.content();
        const $ = cheerio.load(content);

        // Extract post data
        console.log('Extracting posts data...');
        const posts = [];
        const postElements = $('div[role="article"]').slice(0, postsLimit);

        postElements.each((index, element) => {
            try {
                // Generate a unique ID for the post (using timestamp + index as we don't have FB IDs)
                const id = `scraped_${Date.now()}_${index}`;

                // Extract the post text
                // This selector may need updates as Facebook changes their HTML structure
                let message = $(element).find('div.xdj266r').first().text();

                // If we couldn't find the message with that selector, try an alternative
                if (!message) {
                    message = $(element).find('div[data-ad-comet-preview="message"]').text();
                }

                // If still no message, grab any paragraph text
                if (!message) {
                    message = $(element).find('p').text();
                }

                // Extract timestamp (this is challenging as it's often relative like "2 hours ago")
                // For simplicity, we'll use the current time
                const created_time = new Date().toISOString();

                // Don't add empty posts
                if (message) {
                    posts.push({
                        id,
                        message,
                        created_time
                    });
                }
            } catch (err) {
                console.error(`Error extracting post ${index}:`, err.message);
            }
        });

        console.log(`Successfully scraped ${posts.length} posts from Facebook page`);
        return posts;

    } catch (error) {
        console.error('Error during Facebook scraping:', error.message);
        return [];
    } finally {
        // Always close the browser
        await browser.close();
    }
}

/**
 * Check for new posts using web scraping
 * @param {string} pageId - Facebook page ID or username
 * @param {string} storageFilePath - Path to storage file for keeping track of seen posts
 * @param {number} postsLimit - Maximum number of posts to fetch
 * @returns {Promise<Array>} - Array of new post objects
 */
async function checkForNewPostsAlternative(pageId, storageFilePath, postsLimit = 5) {
    // Initialize or load storage
    let storage;
    if (!fs.existsSync(storageFilePath)) {
        storage = {
            lastCheck: new Date().toISOString(),
            seenPosts: []
        };
        fs.writeFileSync(storageFilePath, JSON.stringify(storage, null, 2));
    } else {
        storage = JSON.parse(fs.readFileSync(storageFilePath, 'utf8'));
    }

    try {
        // Scrape posts
        const posts = await scrapePagePosts(pageId, postsLimit);

        if (posts.length === 0) {
            console.log('No posts scraped or an error occurred');
            return [];
        }

        // Filter new posts (we use message content as a proxy since IDs are generated)
        const seenMessages = storage.seenPosts.map(post =>
            typeof post === 'string' ? post : post.message || post.id
        );

        const newPosts = posts.filter(post =>
            !seenMessages.some(seen => seen === post.message || seen === post.id)
        );

        if (newPosts.length > 0) {
            console.log(`Found ${newPosts.length} new posts via web scraping!`);

            // Update storage with new posts information
            // Store either the ID or the full message for comparison
            const updatedSeenPosts = [
                ...newPosts.map(post => ({ id: post.id, message: post.message })),
                ...storage.seenPosts
            ].slice(0, 100); // Keep only the last 100 items to avoid unlimited growth

            storage.lastCheck = new Date().toISOString();
            storage.seenPosts = updatedSeenPosts;

            fs.writeFileSync(storageFilePath, JSON.stringify(storage, null, 2));
        } else {
            console.log('No new posts found');

            // Update last check time
            storage.lastCheck = new Date().toISOString();
            fs.writeFileSync(storageFilePath, JSON.stringify(storage, null, 2));
        }

        return newPosts;

    } catch (error) {
        console.error('Error checking for new posts with alternative method:', error.message);
        return [];
    }
}

module.exports = {
    scrapePagePosts,
    checkForNewPostsAlternative
};