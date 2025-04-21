// server.js - Express server for Zamcelco Alert Service Web UI
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

// Import alert script functions
const alertScript = require('./alertScript');

// Initialize express app and socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Load environment variables from .env file (already done in alertScript but for clarity)
require('dotenv').config();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store recent posts and service status
const serviceData = {
    isRunning: false,
    useAlternative: false,
    lastCheck: null,
    recentPosts: [],
    checkInterval: parseInt(process.env.CHECK_INTERVAL_MS) || 15 * 60 * 1000,
    facebookPageId: process.env.FACEBOOK_PAGE_ID || 'Unknown',
    statusMessage: 'Service not started'
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json(serviceData);
});

// Load recent posts from storage file
function loadRecentPosts() {
    const storageFile = path.join(__dirname, 'seen_posts.json');
    if (fs.existsSync(storageFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
            serviceData.lastCheck = data.lastCheck;

            // If using alternative method, the posts might be stored differently
            if (Array.isArray(data.seenPosts) && data.seenPosts.length > 0) {
                // Handle both formats (string IDs and objects with messages)
                serviceData.recentPosts = data.seenPosts
                    .filter(post => typeof post === 'object')
                    .map(post => ({
                        id: post.id || 'unknown',
                        message: post.message || 'No message content',
                        created_time: post.created_time || data.lastCheck
                    }))
                    .slice(0, 10); // Only keep the 10 most recent posts
            }
        } catch (error) {
            console.error('Error loading recent posts:', error.message);
        }
    }
}

// Socket.io events
io.on('connection', (socket) => {
    console.log('New client connected');

    // Send current status to the newly connected client
    socket.emit('statusUpdate', serviceData);

    // Handle start monitoring request
    socket.on('startMonitoring', async (useAlt) => {
        if (!serviceData.isRunning) {
            serviceData.isRunning = true;
            serviceData.useAlternative = useAlt;
            serviceData.statusMessage = useAlt
                ? 'Monitoring using alternative method (web scraping)'
                : 'Monitoring using Facebook API';

            io.emit('statusUpdate', serviceData);

            // Start the monitoring process
            startMonitoringProcess(useAlt);
        }
    });

    // Handle stop monitoring request
    socket.on('stopMonitoring', () => {
        if (serviceData.isRunning) {
            serviceData.isRunning = false;
            serviceData.statusMessage = 'Service stopped by user';
            io.emit('statusUpdate', serviceData);

            // We don't actually stop the intervals here as that would be complex
            // In a production app, you would clear the interval and stop the process
        }
    });

    // Handle manual check request
    socket.on('checkNow', async () => {
        if (serviceData.isRunning) {
            serviceData.statusMessage = 'Manual check initiated...';
            io.emit('statusUpdate', serviceData);

            await performCheck(serviceData.useAlternative);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Custom notification function that updates the web UI
function notifyWebUI(post) {
    const header = alertScript.extractHeader(post.message);

    // Format created time using moment
    const formattedTime = moment(post.created_time).format('MMM D, YYYY h:mm A');

    // Add to recent posts
    serviceData.recentPosts.unshift({
        id: post.id,
        message: post.message,
        created_time: post.created_time,
        header: header,
        formatted_time: formattedTime
    });

    // Keep only the 10 most recent posts
    serviceData.recentPosts = serviceData.recentPosts.slice(0, 10);

    // Update all connected clients
    io.emit('newPost', {
        post: {
            id: post.id,
            header: header,
            message: post.message,
            created_time: post.created_time,
            formatted_time: formattedTime
        },
        status: serviceData
    });

    // Also use the standard notification
    alertScript.notifyNewPost(post);
}

// Custom check function
async function performCheck(useAlternative) {
    serviceData.statusMessage = 'Checking for new posts...';
    io.emit('statusUpdate', serviceData);

    try {
        let newPosts = [];

        if (useAlternative) {
            // Use alternative method
            newPosts = await alertScript.checkPostsAlternative();
        } else {
            // Regular API method - We need to replicate some of the logic from alertScript
            const posts = await alertScript.fetchLatestPosts();

            if (posts.length > 0) {
                // Load storage to filter seen posts
                const storageFile = path.join(__dirname, 'seen_posts.json');
                const storage = JSON.parse(fs.readFileSync(storageFile, 'utf8'));

                // Find new posts
                newPosts = posts.filter(post => !storage.seenPosts.includes(post.id));
            }
        }

        serviceData.lastCheck = new Date().toISOString();

        if (newPosts.length > 0) {
            // Process new posts (newest first)
            newPosts
                .sort((a, b) => new Date(b.created_time) - new Date(a.created_time))
                .forEach(post => notifyWebUI(post));

            serviceData.statusMessage = `Found ${newPosts.length} new posts! Last checked: ${moment(serviceData.lastCheck).format('MMM D, YYYY h:mm A')}`;
        } else {
            serviceData.statusMessage = `No new posts found. Last checked: ${moment(serviceData.lastCheck).format('MMM D, YYYY h:mm A')}`;
        }

        // Reload recent posts from storage
        loadRecentPosts();

        // Update all connected clients
        io.emit('statusUpdate', serviceData);

    } catch (error) {
        console.error('Error in check process:', error);
        serviceData.statusMessage = `Error checking for posts: ${error.message}`;
        io.emit('statusUpdate', serviceData);
    }
}

// Start the monitoring process and handle intervals
function startMonitoringProcess(useAlternative) {
    // Perform initial check
    performCheck(useAlternative);

    // Set interval for periodic checks
    const intervalId = setInterval(() => {
        if (serviceData.isRunning) {
            performCheck(useAlternative);
        }
    }, serviceData.checkInterval);

    // Log start message
    console.log(`\nWeb UI monitoring started with ${useAlternative ? 'alternative method' : 'Facebook API'}`);
    console.log(`Check interval: ${serviceData.checkInterval / (60 * 1000)} minutes`);
    console.log(`Web interface running at http://localhost:3000`);
}

// Initialize by loading recent posts
loadRecentPosts();

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Zamcelco Alert Service Web UI running on port ${PORT}`);
});