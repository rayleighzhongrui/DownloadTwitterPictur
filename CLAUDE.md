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
- **popup.html/popup.js**: UI for configuring filename formats, platform/notification switches, and error logs (auto-saved, dark-mode aware)
- **rules.json**: Declarative Net Request rules for Pixiv image access

### Key Features
1. **Twitter Integration**: Detects like button clicks on timeline and image tweets
2. **Pixiv Integration**: Detects bookmark clicks on artwork detail pages and galleries
3. **Custom Filename**: Supports various format combinations (account, tweetId, illustId, timestamp); click order in the popup defines the join order
4. **Platform Control**: Individual toggle switches for Twitter/Pixiv functionality
5. **Auto-save Settings**: Popup changes are written to storage immediately (content script reacts via storage.onChanged); no save button
6. **Proxy**: Built-in hardcoded reverse proxy domain for Pixiv originals (`src/core/proxy-manager.js`); no user configuration, falls back to direct i.pximg.net download
7. **Notifications & Logs**: Batch progress notifications (single updating notification), retry warnings, interrupted-download tracking, and error log viewer with JSON export

### File Dependencies
- **Twitter**: Uses data-testid selectors for detecting like buttons and tweet containers
- **Pixiv**: Uses class name patterns for detecting bookmark buttons across different layout modes
- **Proxy**: Hardcoded built-in domain (`src/core/proxy-manager.js`); direct download fallback in `pixiv-platform.js downloadWithFallback`
- **i18n**: All popup/notification strings go through `_locales/*/messages.json` (via `src/utils/i18n.js`); no hardcoded user-facing Chinese in code

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
None. The Pixiv proxy is built in (hardcoded domain in `src/core/proxy-manager.js`); users never configure proxies.

### Manual Validation
1. **Twitter Test**: Like a tweet with images → check Downloads folder
2. **Pixiv Test**: Bookmark artwork → check Downloads folder
3. **Settings Test**: Toggle popup switches / format options → verify they persist after closing and reopening the popup
4. **Logs Test**: Trigger a failure and verify "日志" tab lists errors

### Platform Notes
- **Manifest V3**: Uses service worker background.js (not persistent background page)
- **Permissions**: Requires downloads, storage, activeTab, declarativeNetRequest, notifications
- **Hosts**: Supports twitter.com, x.com, pixiv.net, i.pximg.net
- **Browser**: Chrome manifest v3, may need adaptation for Firefox/Edge
