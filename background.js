// background.js

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "downloadImage" && request.url) {
        console.log('收到下载图片请求:', request.url);

        // 获取开关状态，决定是否进行下载
        chrome.storage.sync.get(['twitterSwitchActive', 'pixivSwitchActive'], function(result) {
            const twitterActive = result.twitterSwitchActive || false;
            const pixivActive = result.pixivSwitchActive || false;

            // 检查当前平台是否启用了下载功能
            if ((request.platform === 'twitter' && twitterActive) || (request.platform === 'pixiv' && pixivActive)) {
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
            } else {
                // 如果开关没有启用，则忽略下载请求
                console.log(`插件在 ${request.platform} 上未启用，跳过下载`);
                sendResponse({ success: false, error: '插件未启用' });
            }
        });

        return true;
    }
});
