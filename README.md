# Zamcelco Alert Service

![Zamcelco Alert Monitor](https://img.shields.io/badge/Zamcelco-Alert%20Monitor-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![Status](https://img.shields.io/badge/status-active-brightgreen)

A real-time monitoring service for Zamcelco Facebook posts. Get notified immediately when new announcements are posted.

![Screenshot](https://via.placeholder.com/800x450.png?text=Zamcelco+Alert+Service+Screenshot)

## 🌟 Features

- **Real-time Monitoring**: Automatically checks for new Facebook posts at configurable intervals
- **Multiple Monitoring Methods**: Use either the official Facebook Graph API or a web scraper method
- **Desktop Notifications**: Get notified immediately when new posts are detected
- **Sleek Web Interface**: Modern dark mode UI inspired by GitHub and Twitter
- **Responsive Design**: Works on desktop and mobile browsers
- **Real-time Updates**: Socket.io integration for live updates without page refresh

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- Facebook Page ID for the page you want to monitor
- Facebook Developer Access Token (for API method only)

## 🚀 Installation

1. Clone the repository or download the source code:

```bash
git clone https://github.com/yourusername/zamcelco-alert-service.git
cd zamcelco-alert-service
```

2. Install the dependencies:

```bash
npm install
```

3. Configure the environment variables by creating a `.env` file:

```
# Facebook configuration
FACEBOOK_PAGE_ID=ZAMCELCOPage
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token

# Check interval in milliseconds (15 minutes)
CHECK_INTERVAL_MS=900000

# Maximum number of posts to fetch
POSTS_LIMIT=10
```

## 💻 Usage

### Command Line (Terminal) Mode

Run the service using the Facebook API method:

```bash
node alertScript.js
```

Or run with the alternative web scraping method:

```bash
node alertScript.js --alternative
```

### Web Interface Mode

Start the web server:

```bash
node server.js
```

Then open your browser and navigate to:

```
http://localhost:3000
```

From the web interface, you can:
- Start monitoring with either the Facebook API or web scraper method
- Stop the monitoring service
- Manually trigger checks for new posts
- View recent posts and notifications
- See the real-time status of the monitoring service

## 📱 Web Interface Features

- **Status Dashboard**: See the current status of the monitoring service
- **Control Panel**: Start/stop monitoring and trigger manual checks
- **Recent Posts**: View a list of recent posts from the Facebook page
- **Real-time Notifications**: Get alerts when new posts are detected
- **Keyboard Shortcuts**: Quick actions with keyboard combinations
- **Connection Status**: Visual indicator of connection to the server

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FACEBOOK_PAGE_ID` | ID or username of the Facebook page to monitor | - |
| `FACEBOOK_ACCESS_TOKEN` | Facebook access token with pages_read_engagement permission | - |
| `CHECK_INTERVAL_MS` | Interval between checks in milliseconds | 900000 (15 minutes) |
| `POSTS_LIMIT` | Maximum number of posts to fetch | 10 |

### Getting a Facebook Access Token

1. Visit [Facebook Developer Tools](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown menu
3. Under "User or Page", select "Get Token" > "Get User Access Token"
4. Check the "pages_read_engagement" permission
5. Click "Generate Access Token"

## 🧩 Architecture

The project consists of several components:

- **alertScript.js**: Core script for checking Facebook posts using the official API
- **alternativeChecker.js**: Alternative method using Puppeteer for web scraping
- **server.js**: Express server for the web interface, integrates with the core functionality
- **public/**: Web interface files (HTML, CSS, JavaScript)

## ⚠️ Limitations

- Facebook API tokens expire and may require regular renewal
- The "Feature Unavailable" error may occur with the API method due to Facebook restrictions
- Web scraping method may break if Facebook changes their page structure
- Web scraping may be against Facebook's terms of service in some contexts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📬 Contact

For questions or feedback, please open an issue on GitHub.

---

Made with ❤️ for the Zamboanga City Community
