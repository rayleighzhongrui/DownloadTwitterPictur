# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

这是一个Chrome浏览器扩展，主要功能是在Twitter和Pixiv网站上通过点赞/收藏操作自动下载原图，支持文件名自定义格式。

**English description**: Chrome extension for downloading original images from Twitter and Pixiv when users like/favorite content, with customizable filename formats.

## Architecture & Structure

### Core Components
- **manifest.json**: Extension manifest with V3规范 (permissions, content scripts, declarative net rules)
- **background.js**: Service worker handling download functionality via chrome.downloads API
- **src/content.js**: Content script dispatcher for Twitter/Pixiv platforms
- **src/platforms/**: Twitter/Pixiv platform logic split into detector/api/platform modules
- **src/core/**: Config, filename generator, proxy manager, downloader base
- **src/utils/**: Storage helpers, retry, notifications, error logger
- **popup.html/popup.js**: UI for configuring filename formats, proxy settings, logs
- **rules.json**: Declarative Net Request rules for Pixiv image access

### Key Features
1. **Twitter Integration**: Detects like button clicks on timeline and image tweets
2. **Pixiv Integration**: Detects bookmark clicks on artwork detail pages and galleries
3. **Custom Filename**: Supports various format combinations (account, tweetId, illustId, timestamp)
4. **Platform Control**: Individual toggle switches for Twitter/Pixiv functionality
5. **Proxy Management**: UI-based Pixiv proxy configuration and switching
6. **Notifications & Logs**: Download notifications, retry warnings, and error log viewer

### File Dependencies
- **Twitter**: Uses data-testid selectors for detecting like buttons and tweet containers
- **Pixiv**: Uses class name patterns for detecting bookmark buttons across different layout modes
- **Proxy**: Configured via popup UI (no code changes required)

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
Configure Pixiv proxy from the popup "代理" tab before testing downloads.

### Manual Validation
1. **Twitter Test**: Like a tweet with images → check Downloads folder
2. **Pixiv Test**: Bookmark artwork → check Downloads folder
3. **Settings Test**: Test popup functionality for filename format changes
4. **Proxy Test**: Add proxy in popup and use "测试" button
5. **Logs Test**: Trigger a failure and verify "日志" tab lists errors

### Platform Notes
- **Manifest V3**: Uses service worker background.js (not persistent background page)
- **Permissions**: Requires downloads, storage, activeTab, declarativeNetRequest, notifications
- **Hosts**: Supports twitter.com, x.com, pixiv.net, i.pximg.net
- **Browser**: Chrome manifest v3, may need adaptation for Firefox/Edge
