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
                formats = result.pixivFilenameFormat || ['illustId'];
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
});
