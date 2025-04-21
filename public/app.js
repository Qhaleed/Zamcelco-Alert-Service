// app.js - Client-side JavaScript for Zamcelco Alert Service Web UI

// Connect to the server using Socket.IO
const socket = io();

// DOM Elements
const statusMessage = document.getElementById('status-message');
const lastCheck = document.getElementById('last-check');
const pageId = document.getElementById('page-id');
const checkInterval = document.getElementById('check-interval');
const startStandard = document.getElementById('start-standard');
const startAlternative = document.getElementById('start-alternative');
const stopBtn = document.getElementById('stop');
const checkNowBtn = document.getElementById('check-now');
const postsContainer = document.getElementById('posts-container');
const notificationArea = document.getElementById('notification-area');

// Add loading indicators to buttons
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        const originalText = button.innerHTML;
        button.dataset.originalText = originalText;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;
    } else if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        button.disabled = false;
    }
}

// Event Listeners
startStandard.addEventListener('click', () => {
    setButtonLoading(startStandard, true);
    socket.emit('startMonitoring', false);
});

startAlternative.addEventListener('click', () => {
    setButtonLoading(startAlternative, true);
    socket.emit('startMonitoring', true);
});

stopBtn.addEventListener('click', () => {
    setButtonLoading(stopBtn, true);
    socket.emit('stopMonitoring');
});

checkNowBtn.addEventListener('click', () => {
    setButtonLoading(checkNowBtn, true);
    socket.emit('checkNow');
});

// Handle status updates from the server
socket.on('statusUpdate', (data) => {
    updateUI(data);
    // Reset all button loading states
    setButtonLoading(startStandard, false);
    setButtonLoading(startAlternative, false);
    setButtonLoading(stopBtn, false);
    setButtonLoading(checkNowBtn, false);
});

// Handle new post notifications
socket.on('newPost', (data) => {
    showNotification(`New post: ${data.post.header}`);
    updateUI(data.status);
    addPostToUI(data.post, true); // true indicates it's a new post
});

// Update UI with current service status
function updateUI(data) {
    // Update status indicators
    statusMessage.textContent = data.statusMessage;

    // Update last check time if available
    if (data.lastCheck) {
        lastCheck.textContent = moment(data.lastCheck).format('MMM D, YYYY h:mm A');
    } else {
        lastCheck.textContent = 'Never';
    }

    // Update page ID
    pageId.textContent = data.facebookPageId;

    // Update check interval
    const intervalMinutes = data.checkInterval / (60 * 1000);
    checkInterval.textContent = `${intervalMinutes} minutes`;

    // Update button states
    if (data.isRunning) {
        startStandard.disabled = true;
        startAlternative.disabled = true;
        stopBtn.disabled = false;
        checkNowBtn.disabled = false;

        // Add active indicator to the running method
        if (data.useAlternative) {
            startAlternative.classList.add('active');
            startStandard.classList.remove('active');
        } else {
            startStandard.classList.add('active');
            startAlternative.classList.remove('active');
        }
    } else {
        startStandard.disabled = false;
        startAlternative.disabled = false;
        stopBtn.disabled = true;
        checkNowBtn.disabled = true;
        startStandard.classList.remove('active');
        startAlternative.classList.remove('active');
    }

    // Update posts list if available
    if (data.recentPosts && data.recentPosts.length > 0) {
        renderPosts(data.recentPosts);
    }
}

// Render the list of posts
function renderPosts(posts) {
    // Check if we only have the empty state
    const hasOnlyEmptyState = postsContainer.children.length === 1 &&
        postsContainer.children[0].classList.contains('empty-state');

    if (hasOnlyEmptyState) {
        // Clear the empty state
        postsContainer.innerHTML = '';
    }

    // Sort posts by date (newest first)
    const sortedPosts = [...posts].sort((a, b) =>
        new Date(b.created_time) - new Date(a.created_time)
    );

    // Add each post to the container
    sortedPosts.forEach(post => {
        addPostToUI(post);
    });
}

// Add a single post to the UI
function addPostToUI(post, isNew = false) {
    // Create post element
    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    if (isNew) {
        postElement.classList.add('new-post');
    }
    postElement.setAttribute('data-post-id', post.id);

    // Format timestamp if not already formatted
    const formattedTime = post.formatted_time || moment(post.created_time).format('MMM D, YYYY h:mm A');

    // Get post header if not already extracted
    const header = post.header || post.message?.split('\n')[0] || 'No content';

    // Create post content
    postElement.innerHTML = `
        <div class="post-header">
            <div class="post-title">${header}</div>
            <div class="post-time"><i class="fa-regular fa-clock"></i> ${formattedTime}</div>
        </div>
        <div class="post-content">${post.message || 'No content'}</div>
        <div class="post-actions">
            <div class="post-action">
                <i class="fa-brands fa-facebook"></i> View on Facebook
            </div>
        </div>
    `;

    // Add click handler to open Facebook post
    const viewAction = postElement.querySelector('.post-action');
    viewAction.addEventListener('click', () => {
        const pageId = document.getElementById('page-id').textContent;
        window.open(`https://www.facebook.com/${pageId}`, '_blank');
    });

    // Add to the container, handling duplicates
    const existingPost = document.querySelector(`[data-post-id="${post.id}"]`);
    if (existingPost) {
        postsContainer.replaceChild(postElement, existingPost);
    } else {
        // Check if we have the empty state and remove it
        const emptyState = postsContainer.querySelector('.empty-state');
        if (emptyState) {
            postsContainer.innerHTML = '';
        }

        // Add the new post at the top with a fade-in animation
        if (postsContainer.firstChild) {
            postsContainer.insertBefore(postElement, postsContainer.firstChild);
        } else {
            postsContainer.appendChild(postElement);
        }

        // Add animation for new posts
        if (isNew) {
            postElement.style.animation = 'fadeIn 0.5s ease-out';
            setTimeout(() => {
                postElement.style.animation = '';
            }, 500);
        }
    }
}

// Show a notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fa-solid fa-bell"></i> ${message}
    `;

    notificationArea.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remove after animation
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Check connection status
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showNotification('<i class="fa-solid fa-triangle-exclamation"></i> Disconnected from server. Reconnecting...');

    // Disable buttons during disconnect
    startStandard.disabled = true;
    startAlternative.disabled = true;
    stopBtn.disabled = true;
    checkNowBtn.disabled = true;
});

// Add element to show connection status
const connectionStatus = document.createElement('div');
connectionStatus.className = 'connection-status';
connectionStatus.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Connecting...';
document.body.appendChild(connectionStatus);

socket.on('connect', () => {
    connectionStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected';
    connectionStatus.classList.add('connected');

    setTimeout(() => {
        connectionStatus.style.opacity = '0';
    }, 2000);
});

socket.on('disconnect', () => {
    connectionStatus.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Disconnected';
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    connectionStatus.style.opacity = '1';
});

// Add keypress shortcuts
document.addEventListener('keydown', (event) => {
    // Ctrl+Alt+S to start with standard API
    if (event.ctrlKey && event.altKey && event.code === 'KeyS' && !startStandard.disabled) {
        startStandard.click();
    }

    // Ctrl+Alt+A to start with alternative method
    if (event.ctrlKey && event.altKey && event.code === 'KeyA' && !startAlternative.disabled) {
        startAlternative.click();
    }

    // Ctrl+Alt+X to stop
    if (event.ctrlKey && event.altKey && event.code === 'KeyX' && !stopBtn.disabled) {
        stopBtn.click();
    }

    // Ctrl+Alt+C to check now
    if (event.ctrlKey && event.altKey && event.code === 'KeyC' && !checkNowBtn.disabled) {
        checkNowBtn.click();
    }
});

// Initialize by requesting current status
socket.emit('statusUpdate');