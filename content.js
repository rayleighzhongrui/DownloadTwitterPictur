// 【重要】请在这里修改为您自己的反向代理域名
const MY_PIXIV_PROXY_DOMAIN = 'pixiv.zhongrui.app'; // <--- 修改这里

let twitterListenerAdded = false; // 用于追踪事件监听器是否已添加
let pixivListenerAdded = false;

// 首次加载时检查存储中的开关状态
chrome.storage.sync.get(['twitterSwitchActive', 'pixivSwitchActive'], function(result) {
    const twitterActive = (typeof result.twitterSwitchActive === 'undefined') ? true : result.twitterSwitchActive;
    const pixivActive = (typeof result.pixivSwitchActive === 'undefined') ? true : result.pixivSwitchActive;

    handleTwitterFunctionality(twitterActive);
    handlePixivFunctionality(pixivActive);
});

// 监听开关状态的变化
chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'sync') {
        if (changes.twitterSwitchActive) {
            const twitterActive = changes.twitterSwitchActive.newValue;
            handleTwitterFunctionality(twitterActive);
        }

        if (changes.pixivSwitchActive) {
            const pixivActive = changes.pixivSwitchActive.newValue;
            handlePixivFunctionality(pixivActive);
        }
    }
});

// Twitter功能逻辑 (保持不变)
function handleTwitterFunctionality(isActive) {
    if (isActive) {
        if (!twitterListenerAdded) {
            console.log('插件在Twitter上启用');
            document.addEventListener('click', twitterClickListener, true);
            twitterListenerAdded = true;
        }
    } else {
        console.log('Twitter 插件关闭，移除功能');
        if (twitterListenerAdded) {
            document.removeEventListener('click', twitterClickListener, true);
            twitterListenerAdded = false;
        }
    }
}

function twitterClickListener(e) {
    if (e.target.closest('[data-testid="like"]')) {
        console.log('已捕获Twitter点赞');
        const tweetContainer = e.target.closest('[data-testid="cellInnerDiv"]');
        if (tweetContainer) {
            let authorId = 'unknown_author';
            const usernameSpans = tweetContainer.querySelectorAll('[data-testid="User-Name"] span');
            usernameSpans.forEach(span => {
                const textContent = span.textContent.trim();
                if (textContent.includes('@')) { authorId = textContent; }
            });
            console.log('获取的作者ID:', authorId);

            let tweetId = tweetContainer.querySelector('a[href*="/status/"]')?.href.match(/status\/(\d+)/)?.[1] || 'unknown_tweet_id';
            console.log('获取的推特ID:', tweetId);

            // 获取推文发布时间
            let tweetTime = 'unknown_time';
            const timeElement = tweetContainer.querySelector('time');
            if (timeElement) {
                const datetime = timeElement.getAttribute('datetime');
                if (datetime) {
                    // 解析ISO 8601格式时间并转换为YYYYMMDD格式
                    const date = new Date(datetime);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    tweetTime = `${year}${month}${day}`;
                }
            }
            console.log('获取的推文时间:', tweetTime);

            // 下载图片
            const images = tweetContainer.querySelectorAll('img');
            images.forEach((img) => {
                if (img.src.includes('pbs.twimg.com/media/')) {
                    let imgUrl = new URL(img.src);
                    imgUrl.searchParams.set('name', 'orig');
                    console.log('已获取图片链接:', imgUrl.toString());
                    chrome.runtime.sendMessage({
                        action: "downloadImage",
                        url: imgUrl.toString(),
                        authorId: authorId,
                        tweetId: tweetId,
                        tweetTime: tweetTime,
                        platform: 'twitter'
                    }, function(response) {
                        if (chrome.runtime.lastError) { console.error('发送消息时发生错误:', chrome.runtime.lastError.message); }
                        else if (response && response.success) { console.log('图片下载成功，ID:', response.downloadId); }
                        else { console.error('图片下载失败，错误:', response ? response.error : '无响应'); }
                    });
                }
            });

            // 下载视频
            const videoComponents = tweetContainer.querySelectorAll('[data-testid="videoComponent"]');
            videoComponents.forEach((videoComponent) => {
                const video = videoComponent.querySelector('video');
                if (video && video.poster) {
                    console.log('检测到视频，poster URL:', video.poster);
                    
                    // 从poster URL中提取视频ID
                    const posterMatch = video.poster.match(/amplify_video_thumb\/(\d+)\//);
                    if (posterMatch) {
                        const videoId = posterMatch[1];
                        console.log('提取的视频ID:', videoId);
                        
                        // 获取视频的原始分辨率
                        const actualWidth = video.videoWidth;
                        const actualHeight = video.videoHeight;
                        const originalResolution = `${actualWidth}x${actualHeight}`;
                        
                        console.log('视频原始分辨率:', originalResolution);
                        
                        // 构造原始分辨率的视频URL
                        const videoUrl = `https://video.twimg.com/amplify_video/${videoId}/vid/avc1/${originalResolution}/${videoId}.mp4`;
                        console.log('下载原始分辨率视频:', videoUrl);
                        
                        chrome.runtime.sendMessage({
                            action: "downloadVideo",
                            url: videoUrl,
                            videoId: videoId,
                            resolution: originalResolution,
                            authorId: authorId,
                            tweetId: tweetId,
                            tweetTime: tweetTime,
                            platform: 'twitter'
                        }, function(response) {
                            if (chrome.runtime.lastError) { 
                                console.error('发送视频下载消息时发生错误:', chrome.runtime.lastError.message); 
                            } else if (response && response.success) { 
                                console.log(`视频下载成功 (${originalResolution})，ID:`, response.downloadId); 
                            } else { 
                                console.error(`视频下载失败 (${originalResolution})，错误:`, response ? response.error : '无响应'); 
                            }
                        });
                    } else {
                        console.log('无法从poster URL中提取视频ID:', video.poster);
                    }
                } else {
                    console.log('未找到有效的视频元素');
                }
            });
        }
    }
}

// Pixiv功能逻辑
function handlePixivFunctionality(isActive) {
    if (isActive) {
        if (!pixivListenerAdded) {
            console.log('插件在Pixiv上启用');
            document.addEventListener('click', pixivClickListener, true);
            pixivListenerAdded = true;
        }
    } else {
        console.log('Pixiv 插件关闭，移除功能');
        if (pixivListenerAdded) {
            document.removeEventListener('click', pixivClickListener, true);
            pixivListenerAdded = false;
        }
    }
}

function pixivClickListener(e) {
    const bookmarkButton = e.target.closest('[class*=bookmark]') || e.target.closest('[data-ga4-label="bookmark_button"]');
    if (bookmarkButton) {
        console.log('已捕获Pixiv点赞');
        const url = window.location.href;
        let illustId;
        let images = [];
        let totalImages = 1;

        // 作品详情页逻辑
        if (url.startsWith('https://www.pixiv.net/artworks/')) {
            illustId = url.match(/artworks\/(\d+)/)?.[1] || 'unknown_id';
            const detailsContainer = bookmarkButton.closest('.w-full.flex.flex-col');
            const imageContainer = detailsContainer ? detailsContainer.previousElementSibling : document.querySelector('figure');

            if (imageContainer) {
                images = Array.from(imageContainer.querySelectorAll('img'));
                const span = imageContainer.querySelector('span[class*="sc-1mr081w-0"]');
                if (span && span.childNodes.length > 2) {
                    const spanValue = parseInt(span.childNodes[2].textContent, 10);
                    if (!isNaN(spanValue)) { totalImages = spanValue; }
                }
            }
        // 首页/列表页逻辑
        } else {
            console.log("在列表页/首页，开始多模式匹配...");
            let artworkContainer = null;
            // 模式1: “推荐/精选”布局
            let nearestIllust = bookmarkButton.closest('[class*="sc-9cbefcd0-1"], [class*="sc-9e474da3-0"]');
            if (nearestIllust && nearestIllust.querySelector('img')) {
                artworkContainer = nearestIllust;
                console.log("模式1成功！找到作品容器:", artworkContainer);
            } else {
                // 模式2: “Feed流”布局
                console.log("模式1失败，尝试模式2...");
                const detailsBlock = bookmarkButton.closest('.w-full.flex.flex-col');
                if (detailsBlock) {
                    const candidate = detailsBlock.previousElementSibling;
                    if (candidate && candidate.querySelector('img')) {
                        artworkContainer = candidate;
                        console.log("模式2成功！找到图片容器:", artworkContainer);
                    }
                }
            }

            if (artworkContainer) {
                illustId = artworkContainer.querySelector('a[data-gtm-value]')?.getAttribute('data-gtm-value');
                images = [artworkContainer.querySelector('img')].filter(Boolean);
                const countSpan = artworkContainer.querySelector('span');
                if (countSpan) {
                    const spanValue = parseInt(countSpan.textContent, 10);
                    if (!isNaN(spanValue) && spanValue > 1) { totalImages = spanValue; }
                }
            } else {
                console.error("【列表页】所有已知布局模式均匹配失败。");
            }
        }

        if (images.length === 0) {
            console.log("未能提取到图片信息，操作中止。");
            return;
        }

        console.log('获取的作品ID:', illustId);
        console.log('作品图片总数:', totalImages);
        console.log('找到的图片元素数组:', images);

        const checkAndSendMessage = (url, illustId, index, totalImages, isRetry) => {
            fetch(url, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        console.log('图片存在，发送消息进行下载:', url);
                        chrome.runtime.sendMessage({
                            action: "downloadImage",
                            url: url,
                            illustId: illustId,
                            platform: 'pixiv'
                        }, function(response) {
                            if (chrome.runtime.lastError) { console.error('发送消息时发生错误:', chrome.runtime.lastError.message); }
                            else if (response && response.success) { console.log('图片下载成功，ID:', response.downloadId); }
                            else { console.error('图片下载失败，错误:', response ? response.error : '无响应'); }
                            if (index + 1 < totalImages) {
                                const nextUrl = url.replace(`_p${index}`, `_p${index + 1}`);
                                checkAndSendMessage(nextUrl, illustId, index + 1, totalImages, false);
                            }
                        });
                    } else { throw new Error('图片请求失败'); }
                })
                .catch(error => {
                    console.error('请求错误:', error.message, url);
                    if (!isRetry) {
                        let retryUrl = url.replace('.png', '.jpg');
                        if (retryUrl === url) { retryUrl = url.replace('.jpg', '.png'); }
                        console.log('重试下载图片链接:', retryUrl);
                        setTimeout(() => checkAndSendMessage(retryUrl, illustId, index, totalImages, true), 500);
                    } else {
                        console.error('重试下载也失败:', url);
                        if (index + 1 < totalImages) {
                            let nextBaseUrl = url.replace('.jpg', '.png');
                            const nextUrl = nextBaseUrl.replace(`_p${index}`, `_p${index + 1}`);
                            checkAndSendMessage(nextUrl, illustId, index + 1, totalImages, false);
                        }
                    }
                });
        };

        images.forEach((img) => {
            if (!img || !img.src) return;
            console.log('检测到的图片URL:', img.src);
            const matches = img.src.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_/);
            if (matches) {
                const [/*full match*/, year, month, day, hour, minute, second, matchedIllustId] = matches;
                const finalIllustId = illustId && illustId !== 'unknown_id' ? illustId : matchedIllustId;
                
                // 【核心修改】使用在文件顶部定义的常量来拼接URL
                const originalImgUrl = `https://${MY_PIXIV_PROXY_DOMAIN}/img-original/img/${year}/${month}/${day}/${hour}/${minute}/${second}/${finalIllustId}_p0.png`;
                
                console.log('转换后的图片链接:', originalImgUrl);
                checkAndSendMessage(originalImgUrl, finalIllustId, 0, totalImages, false);
            } else {
                console.log('无法从图片URL中解析出ID和时间戳:', img.src);
            }
        });
    }
}