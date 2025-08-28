# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

这是一个Chrome浏览器扩展，主要功能是在Twitter和Pixiv网站上通过点赞/收藏操作自动下载原图，支持文件名自定义格式。

**English description**: Chrome extension for downloading original images from Twitter and Pixiv when users like/favorite content, with customizable filename formats.

## Architecture & Structure

### Core Components
- **manifest.json**: Extension manifest with V3规范 (permissions, content scripts, declarative net rules)
- **background.js**: Service worker handling download functionality via chrome.downloads API
- **content.js**: Content script injecting into Twitter/Pixiv pages to detect like/bookmark clicks
- **popup.html/popup.js**: UI for configuring filename formats and platform switches
- **rules.json**: Declarative Net Request rules for Pixiv image access

### Key Features
1. **Twitter Integration**: Detects like button clicks on timeline and image tweets
2. **Pixiv Integration**: Detects bookmark clicks on artwork detail pages and galleries
3. **Custom Filename**: Supports various format combinations (account, tweetId, illustId, timestamp)
4. **Platform Control**: Individual toggle switches for Twitter/Pixiv functionality

### File Dependencies
- **Twitter**: Uses data-testid selectors for detecting like buttons and tweet containers
- **Pixiv**: Uses class name patterns for detecting bookmark buttons across different layout modes
- **Proxy**: Configures custom proxy domain `pixiv.zhongrui.app` (needs user customization)

## Development Commands

### Manual Testing
```bash
# Load extension in Chrome developer mode
chrome://extensions/ → Enable Developer mode → Load unpacked
# Select manifest.json

# Access extension popup
Click extension icon → Configure settings
```

### Configuration Required
**IMPORTANT**: Before testing, update line 2 in `content.js`:
```javascript
const MY_PIXIV_PROXY_DOMAIN = 'pixiv.zhongrui.app'; // Replace with your proxy
```

### Manual Validation
1. **Twitter Test**: Like a tweet with images → check Downloads folder
2. **Pixiv Test**: Bookmark artwork → check Downloads folder
3. **Settings Test**: Test popup functionality for filename format changes

### Platform Notes
- **Manifest V3**: Uses service worker background.js (not persistent background page)
- **Permissions**: Requires downloads, storage, activeTab, declarativeNetRequest
- **Hosts**: Supports twitter.com, x.com, pixiv.net, i.pximg.net
- **Browser**: Chrome manifest v3, may need adaptation for Firefox/Edge