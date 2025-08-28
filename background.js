// background.js

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "downloadImage" && request.url) {
        console.log('收到下载图片请求:', request.url);

        chrome.storage.sync.get(['twitterFilenameFormat', 'pixivFilenameFormat'], function(result) {
            let formats = [];
            let filename = '';
            let now = new Date();
            let timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

            // 根据平台选择不同的格式配置
            if (request.platform === 'twitter') {
                formats = result.twitterFilenameFormat || ['account', 'tweetId'];
            } else if (request.platform === 'pixiv') {
                formats = result.pixivFilenameFormat || ['authorName', 'illustId'];
            }

            // 根据用户选择的格式拼接文件名
            formats.forEach(format => {
                switch (format) {
                    case 'account':
                        filename += `${request.authorId}_`;
                        break;
                    case 'tweetId':
                        filename += `${request.tweetId}_`;
                        break;
                    case 'tweetTime':
                        filename += `${request.tweetTime}_`;
                        break;
                    case 'authorName':
                        filename += `${request.authorName}_`;
                        break;
                    case 'authorId':
                        filename += `${request.authorId}_`;
                        break;
                    case 'illustId':
                        filename += `${request.illustId}_`;
                        break;
                    case 'downloadDate':
                        filename += `${timestamp}_`;
                        break;
                    default:
                        break;
                }
            });

            // 去掉最后的下划线并加上扩展名
            filename = filename.slice(0, -1) + '.jpg';

            // 执行下载
            chrome.downloads.download({
                url: request.url,
                filename: filename
            }, function(downloadId) {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError });
                } else {
                    console.log(`图片下载开始，ID: ${downloadId}`);
                    sendResponse({ success: true, downloadId: downloadId });
                }
            });
        });

        return true; // 需要返回 true 来保持异步响应
    }
    
    if (request.action === "downloadVideo" && request.url) {
        console.log('收到下载视频请求:', request.url, '分辨率:', request.resolution);

        chrome.storage.sync.get(['twitterFilenameFormat', 'pixivFilenameFormat'], function(result) {
            let formats = [];
            let filename = '';
            let now = new Date();
            let timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

            // 根据平台选择不同的格式配置
            if (request.platform === 'twitter') {
                formats = result.twitterFilenameFormat || ['account', 'tweetId'];
            } else if (request.platform === 'pixiv') {
                formats = result.pixivFilenameFormat || ['authorName', 'illustId'];
            }

            // 根据用户选择的格式拼接文件名
            formats.forEach(format => {
                switch (format) {
                    case 'account':
                        filename += `${request.authorId}_`;
                        break;
                    case 'tweetId':
                        filename += `${request.tweetId}_`;
                        break;
                    case 'tweetTime':
                        filename += `${request.tweetTime}_`;
                        break;
                    case 'authorName':
                        filename += `${request.authorName}_`;
                        break;
                    case 'authorId':
                        filename += `${request.authorId}_`;
                        break;
                    case 'illustId':
                        filename += `${request.illustId}_`;
                        break;
                    case 'downloadDate':
                        filename += `${timestamp}_`;
                        break;
                    default:
                        break;
                }
            });

            // 去掉最后的下划线并加上视频扩展名，同时添加分辨率标识
            filename = filename.slice(0, -1) + `_${request.resolution}.mp4`;

            // 执行视频下载
            chrome.downloads.download({
                url: request.url,
                filename: filename
            }, function(downloadId) {
                if (chrome.runtime.lastError) {
                    console.log(`视频下载失败 (${request.resolution}):`, chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError });
                } else {
                    console.log(`视频下载开始 (${request.resolution})，ID: ${downloadId}`);
                    sendResponse({ success: true, downloadId: downloadId });
                }
            });
        });

        return true; // 需要返回 true 来保持异步响应
    }
});
