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

// 智能识别收藏按钮
function findPixivBookmarkButton(target) {
    // 策略1: 传统的bookmark类名匹配（作品详情页）
    let button = target.closest('[class*="bookmark"]');
    if (button) return button;
    
    // 策略2: ga4标签匹配
    button = target.closest('[data-ga4-label="bookmark_button"]');
    if (button) return button;
    
    // 策略3: 基于上下文的智能匹配（首页列表）
    button = target.closest('button');
    if (button && isLikelyBookmarkButton(button)) {
        return button;
    }
    
    return null;
}

// 判断按钮是否可能是收藏按钮
function isLikelyBookmarkButton(button) {
    // 检查按钮的上下文：必须在包含图片和链接的容器中
    const container = button.closest('li, [class*="sc-"], div');
    if (!container) return false;
    
    // 必须包含图片和作品链接
    const hasImage = container.querySelector('img');
    const hasArtworkLink = container.querySelector('a[href*="/artworks/"], a[href*="/users/"]');
    
    // 按钮应该包含SVG图标（收藏按钮通常是图标按钮）
    const hasIcon = button.querySelector('svg, img');
    
    // 避免匹配到关注按钮或其他按钮
    const buttonText = button.textContent.trim();
    const isFollowButton = buttonText.includes('关注') || buttonText.includes('フォロー') || buttonText.includes('follow');
    
    return hasImage && hasArtworkLink && hasIcon && !isFollowButton;
}

// 查找作品容器
function findArtworkContainer(bookmarkButton) {
    // 判断是否为推荐流
    if (isRecommendationFeed(bookmarkButton)) {
        return findRecommendationArtworkContainer(bookmarkButton);
    } else {
        return findFollowingArtworkContainer(bookmarkButton);
    }
}

// 判断是否为推荐流
function isRecommendationFeed(bookmarkButton) {
    // 策略1：检查是否在包含data-ga4-label="work_content"的推荐流结构中
    const workContentContainer = bookmarkButton.closest('[data-ga4-label="work_content"]');
    if (workContentContainer) {
        console.log('通过work_content标识检测到推荐流');
        return true;
    }
    
    // 策略2：检查是否存在"其他作品"推荐区域
    const container = bookmarkButton.closest('div');
    if (!container) return false;
    
    const hasRecommendationText = container.textContent.includes('其他作品') || 
                                  container.textContent.includes('的其他作品') ||
                                  container.querySelector('[class*="recommend"], [class*="suggest"]');
    
    // 策略3：检查容器中是否有多个收藏按钮（推荐流特征）
    const bookmarkButtonsCount = container.querySelectorAll('button[data-ga4-label="bookmark_button"]').length;
    const hasMultipleBookmarks = bookmarkButtonsCount > 3; // 超过3个收藏按钮通常是推荐流
    
    // 策略4：检查图片大小（推荐流主图通常较大）
    const mainImg = container.querySelector('img');
    const isLargeImage = mainImg && (mainImg.offsetWidth > 300 || mainImg.offsetHeight > 300);
    
    const isRecommendation = hasRecommendationText || hasMultipleBookmarks || isLargeImage;
    
    if (isRecommendation) {
        console.log('推荐流检测结果:', {
            hasRecommendationText,
            bookmarkButtonsCount,
            hasMultipleBookmarks,
            isLargeImage,
            imageSize: mainImg ? `${mainImg.offsetWidth}x${mainImg.offsetHeight}` : 'none'
        });
    }
    
    return isRecommendation;
}

// 关注流的容器查找（原逻辑）
function findFollowingArtworkContainer(bookmarkButton) {
    // 策略1: 查找最近的listitem容器
    let container = bookmarkButton.closest('li');
    if (container && container.querySelector('img') && container.querySelector('a[href*="/artworks/"]')) {
        return container;
    }
    
    // 策略2: 查找包含styled-components类的容器
    const scContainers = ['[class*="sc-"]', '[class*="gtm-"]'];
    for (const selector of scContainers) {
        container = bookmarkButton.closest(selector);
        if (container && container.querySelector('img') && container.querySelector('a[href*="/artworks/"]')) {
            return container;
        }
    }
    
    // 策略3: 向上查找，直到找到同时包含图片和链接的容器
    let current = bookmarkButton.parentElement;
    while (current && current !== document.body) {
        const hasImage = current.querySelector('img');
        const hasLink = current.querySelector('a[href*="/artworks/"]');
        if (hasImage && hasLink) {
            return current;
        }
        current = current.parentElement;
    }
    
    return null;
}

// 推荐流的容器查找（精确关联逻辑）
function findRecommendationArtworkContainer(bookmarkButton) {
    console.log('检测到推荐流，使用精确关联查找逻辑');
    
    // 策略1：优先查找按钮的直接关联容器
    // 从收藏按钮向上查找，找到包含图片和链接的最小容器
    let current = bookmarkButton;
    let attempts = 0;
    
    while (current && current !== document.body && attempts < 8) {
        current = current.parentElement;
        attempts++;
        
        if (!current) break;
        
        // 检查当前容器是否直接包含图片和作品链接（不包含其他作品）
        const images = Array.from(current.querySelectorAll('img'));
        const artworkLinks = Array.from(current.querySelectorAll('a[href*="/artworks/"]'));
        const bookmarkButtons = Array.from(current.querySelectorAll('button[data-ga4-label="bookmark_button"]'));
        
        // 关键：确保这是一个独立的作品容器（只有一个收藏按钮）
        if (images.length > 0 && artworkLinks.length > 0 && bookmarkButtons.length === 1) {
            // 验证这个收藏按钮就是被点击的按钮
            if (bookmarkButtons[0] === bookmarkButton || bookmarkButtons[0].contains(bookmarkButton)) {
                console.log('找到精确关联的作品容器，容器标签:', current.tagName, '类名:', current.className.substring(0, 50));
                return current;
            }
        }
    }
    
    // 策略2：基于data-ga4-entity-id属性查找
    current = bookmarkButton;
    attempts = 0;
    
    while (current && current !== document.body && attempts < 8) {
        current = current.parentElement;
        attempts++;
        
        if (!current) break;
        
        // 查找具有作品ID数据属性的容器
        const entityId = current.getAttribute('data-ga4-entity-id');
        if (entityId && entityId.startsWith('illust/')) {
            const images = Array.from(current.querySelectorAll('img'));
            const artworkLinks = Array.from(current.querySelectorAll('a[href*="/artworks/"]'));
            
            if (images.length > 0 && artworkLinks.length > 0) {
                console.log('通过data-ga4-entity-id找到作品容器:', entityId);
                return current;
            }
        }
    }
    
    // 策略3：保守的向上查找，但限制范围
    console.log('精确关联查找失败，使用保守策略');
    current = bookmarkButton;
    attempts = 0;
    
    while (current && current !== document.body && attempts < 5) { // 限制查找层数
        current = current.parentElement;
        attempts++;
        
        if (!current) break;
        
        const images = Array.from(current.querySelectorAll('img'));
        const artworkLinks = Array.from(current.querySelectorAll('a[href*="/artworks/"]'));
        
        // 确保不会选择包含太多作品的大容器
        if (images.length > 0 && artworkLinks.length > 0 && artworkLinks.length <= 2) {
            console.log('保守策略找到容器，作品链接数:', artworkLinks.length);
            return current;
        }
    }
    
    console.log('推荐流所有策略均失败，回退到关注流逻辑');
    return findFollowingArtworkContainer(bookmarkButton);
}

function pixivClickListener(e) {
    // 更强大的收藏按钮识别策略
    const bookmarkButton = findPixivBookmarkButton(e.target);
    if (bookmarkButton) {
        console.log('已捕获Pixiv点赞，按钮类:', bookmarkButton.className);
        const url = window.location.href;
        let illustId;
        let authorId = 'unknown_author';
        let authorName = 'unknown_author_name';
        let images = [];
        let totalImages = 1;

        // 作品详情页逻辑
        if (url.startsWith('https://www.pixiv.net/artworks/')) {
            illustId = url.match(/artworks\/(\d+)/)?.[1] || 'unknown_id';
            console.log('作品详情页，作品ID:', illustId);
            
            // 在作品详情页提取作者ID和作者名称
            const authorLinkElement = document.querySelector('a[href*="/users/"]');
            if (authorLinkElement) {
                authorId = authorLinkElement.href.match(/users\/(\d+)/)?.[1] || 'unknown_author';
                
                // 获取作者名称 - 优先从链接文本内容获取
                authorName = authorLinkElement.textContent.trim();
                if (!authorName || authorName.includes('查看') || authorName.includes('更多') || authorName.length > 50) {
                    // 备选：从图片alt属性获取
                    const authorImg = authorLinkElement.querySelector('img');
                    if (authorImg && authorImg.alt && !authorImg.alt.includes('的插画')) {
                        authorName = authorImg.alt.trim();
                    }
                }
                console.log('作品详情页提取的作者ID:', authorId, '作者名称:', authorName);
            }
            
            // 在作品详情页查找图片
            const mainImage = document.querySelector('main img');
            if (mainImage) {
                images = [mainImage];
                // 检查是否有多张图片的标识
                const pageIndicator = document.querySelector('[data-gtm-value]');
                if (pageIndicator) {
                    const match = pageIndicator.textContent.match(/(\d+)\/(\d+)/);
                    if (match) totalImages = parseInt(match[2], 10);
                }
            }
        // 首页/列表页逻辑
        } else {
            console.log("在列表页/首页，开始智能匹配...");
            const artworkContainer = findArtworkContainer(bookmarkButton);
            
            if (artworkContainer) {
                console.log("找到作品容器:", artworkContainer.tagName, artworkContainer.className.substring(0, 50));
                
                // 提取作品ID：优先从链接href中获取
                const artworkLinks = artworkContainer.querySelectorAll('a[href*="/artworks/"]');
                let mainArtworkLink = null;
                
                if (artworkLinks.length > 1) {
                    // 多个链接时，选择最大的（主要作品链接）
                    mainArtworkLink = Array.from(artworkLinks).reduce((largest, current) => {
                        const largestRect = largest.getBoundingClientRect();
                        const currentRect = current.getBoundingClientRect();
                        return (currentRect.width * currentRect.height) > (largestRect.width * largestRect.height) ? current : largest;
                    });
                } else {
                    mainArtworkLink = artworkLinks[0];
                }
                
                if (mainArtworkLink) {
                    illustId = mainArtworkLink.href.match(/artworks\/(\d+)/)?.[1];
                    console.log('从主要链接提取ID:', illustId);
                } else {
                    // 备选：从data属性获取
                    illustId = artworkContainer.querySelector('[data-gtm-value]')?.getAttribute('data-gtm-value');
                    console.log('从data属性提取ID:', illustId);
                }
                
                // 在首页/列表页提取作者ID和作者名称
                const authorLink = artworkContainer.querySelector('a[href*="/users/"]');
                if (authorLink) {
                    authorId = authorLink.href.match(/users\/(\d+)/)?.[1] || 'unknown_author';
                    
                    // 获取作者名称 - 优先从链接文本内容获取
                    authorName = authorLink.textContent.trim();
                    if (!authorName || authorName.includes('查看') || authorName.includes('更多') || authorName.length > 50) {
                        // 备选：从图片alt属性获取
                        const authorImg = authorLink.querySelector('img');
                        if (authorImg && authorImg.alt && !authorImg.alt.includes('的插画')) {
                            authorName = authorImg.alt.trim();
                        }
                    }
                    console.log('首页/列表页提取的作者ID:', authorId, '作者名称:', authorName);
                }
                
                // 获取图片 - 选择最大的图片（避免头像）
                const allImages = Array.from(artworkContainer.querySelectorAll('img'));
                let mainImage = null;
                
                if (allImages.length > 1) {
                    // 过滤掉小图片（头像等），选择最大的
                    const largeImages = allImages.filter(img => {
                        const rect = img.getBoundingClientRect();
                        return rect.width > 80 && rect.height > 80;
                    });
                    
                    if (largeImages.length > 0) {
                        mainImage = largeImages.reduce((largest, current) => {
                            const largestRect = largest.getBoundingClientRect();
                            const currentRect = current.getBoundingClientRect();
                            return (currentRect.width * currentRect.height) > (largestRect.width * largestRect.height) ? current : largest;
                        });
                    }
                } else {
                    mainImage = allImages[0];
                }
                
                if (mainImage) {
                    images = [mainImage];
                    console.log('选择的主图尺寸:', mainImage.offsetWidth, 'x', mainImage.offsetHeight);
                    
                    // 检查多图标识
                    const multiImageIndicator = artworkContainer.querySelector('[class*="sc-"], span');
                    if (multiImageIndicator) {
                        const match = multiImageIndicator.textContent.match(/(\d+)/);
                        if (match && parseInt(match[1], 10) > 1) {
                            totalImages = parseInt(match[1], 10);
                        }
                    }
                }
                
                console.log('提取结果 - ID:', illustId, '图片数:', totalImages, '图片元素:', images.length);
            } else {
                console.error("未能找到作品容器");
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
                            authorId: authorId,
                            authorName: authorName,
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
            
            // 原来的匹配逻辑 - 标准格式 /img/2024/01/01/12/34/56/123456789_
            const matches = img.src.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_/);
            if (matches) {
                const [/*full match*/, year, month, day, hour, minute, second, matchedIllustId] = matches;
                const finalIllustId = illustId && illustId !== 'unknown_id' ? illustId : matchedIllustId;
                
                const originalImgUrl = `https://${MY_PIXIV_PROXY_DOMAIN}/img-original/img/${year}/${month}/${day}/${hour}/${minute}/${second}/${finalIllustId}_p0.png`;
                
                console.log('转换后的图片链接:', originalImgUrl);
                checkAndSendMessage(originalImgUrl, finalIllustId, 0, totalImages, false);
            } else {
                // 新增：支持推荐流的简化格式 /img/2024/01/01/123456789_
                const simpleMatches = img.src.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)_/);
                if (simpleMatches) {
                    const [/*full match*/, year, month, day, matchedIllustId] = simpleMatches;
                    const finalIllustId = illustId && illustId !== 'unknown_id' ? illustId : matchedIllustId;
                    
                    // 尝试不同的路径格式
                    const originalImgUrl = `https://${MY_PIXIV_PROXY_DOMAIN}/img-original/img/${year}/${month}/${day}/00/00/00/${finalIllustId}_p0.png`;
                    
                    console.log('推荐流格式，转换后的图片链接:', originalImgUrl);
                    checkAndSendMessage(originalImgUrl, finalIllustId, 0, totalImages, false);
                } else {
                    console.log('无法从图片URL中解析出ID和时间戳:', img.src);
                }
            }
        });
    }
}