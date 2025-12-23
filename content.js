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

            // 下载视频 - 监听网络请求获取视频URL
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

                        // 尝试获取并下载视频URL
                        attemptVideoDownload(videoId, originalResolution, authorId, tweetId, tweetTime);
                    } else {
                        console.log('无法从poster URL中提取视频ID:', video.poster);
                    }
                } else {
                    console.log('未找到有效的视频元素');
                }
            });

            // 尝试多种方法获取视频URL并下载
            async function attemptVideoDownload(videoId, resolution, authorId, tweetId, tweetTime) {
                // 方法1: 调用Twitter GraphQL API获取推文数据（包含视频URL）
                console.log('尝试通过Twitter API获取视频URL...');
                try {
                    const videoUrl = await fetchVideoUrlFromTwitterAPI(tweetId);
                    if (videoUrl) {
                        console.log('从Twitter API找到视频URL:', videoUrl);
                        downloadVideo(videoUrl, videoId, resolution, authorId, tweetId, tweetTime);
                        return;
                    }
                } catch (error) {
                    console.log('Twitter API方法失败:', error.message);
                }

                // 方法2: 尝试从Performance API获取
                const resources = performance.getEntriesByType('resource');
                for (const resource of resources) {
                    if (resource.name.includes('video.twimg.com') &&
                        resource.name.includes('amplify_video') &&
                        resource.name.includes(videoId) &&
                        resource.name.includes('.mp4') &&
                        !resource.name.includes('.m4s')) {
                        console.log('从Performance API找到视频URL:', resource.name);
                        downloadVideo(resource.name, videoId, resolution, authorId, tweetId, tweetTime);
                        return;
                    }
                }

                // 方法3: 尝试触发视频加载并监听请求
                console.log('尝试触发视频加载并监听请求...');
                setupNetworkListener(videoId, resolution, authorId, tweetId, tweetTime);
            }

            // 通过Twitter GraphQL API获取视频URL
            async function fetchVideoUrlFromTwitterAPI(tweetId) {
                try {
                    // 从cookie中获取csrf token
                    const csrfToken = getCsrfToken();
                    if (!csrfToken) {
                        throw new Error('无法获取CSRF token');
                    }

                    // Twitter GraphQL API 配置（参考Media Harvest的实现）
                    const QUERY_ID = '_8aYOgEDz35BrBcBal1-_w';
                    const QUERY_NAME = 'TweetDetail';

                    const variables = {
                        focalTweetId: tweetId,
                        rankingMode: 'Relevance',
                        includePromotedContent: false,
                        withCommunity: false,
                        withQuickPromoteEligibilityTweetFields: false,
                        withBirdwatchNotes: false,
                        withVoice: false,
                    };

                    const features = {
                        rweb_video_screen_enabled: false,
                        profile_label_improvements_pcf_label_in_post_enabled: true,
                        rweb_tipjar_consumption_enabled: true,
                        verified_phone_label_enabled: false,
                        creator_subscriptions_tweet_preview_api_enabled: true,
                        responsive_web_graphql_timeline_navigation_enabled: true,
                        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
                        premium_content_api_read_enabled: false,
                        communities_web_enable_tweet_community_results_fetch: true,
                        c9s_tweet_anatomy_moderator_badge_enabled: true,
                        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
                        responsive_web_grok_analyze_post_followups_enabled: true,
                        responsive_web_jetfuel_frame: false,
                        responsive_web_grok_share_attachment_enabled: true,
                        articles_preview_enabled: true,
                        responsive_web_edit_tweet_api_enabled: true,
                        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
                        view_counts_everywhere_api_enabled: true,
                        longform_notetweets_consumption_enabled: true,
                        responsive_web_twitter_article_tweet_consumption_enabled: true,
                        tweet_awards_web_tipping_enabled: false,
                        responsive_web_grok_show_grok_translated_post: false,
                        responsive_web_grok_analysis_button_from_backend: false,
                        creator_subscriptions_quote_tweet_preview_enabled: false,
                        freedom_of_speech_not_reach_fetch_enabled: true,
                        standardized_nudges_misinfo: true,
                        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
                        longform_notetweets_rich_text_read_enabled: true,
                        longform_notetweets_inline_media_enabled: true,
                        responsive_web_grok_image_annotation_enabled: true,
                        responsive_web_enhance_cards_enabled: false,
                    };

                    const fieldToggles = {
                        withArticleRichContentState: true,
                        withArticlePlainText: false,
                        withGrokAnalyze: false,
                        withDisallowedReplyControls: false,
                    };

                    // 构建URL
                    const url = new URL(`https://x.com/i/api/graphql/${QUERY_ID}/${QUERY_NAME}`);
                    url.searchParams.append('variables', JSON.stringify(variables));
                    url.searchParams.append('features', JSON.stringify(features));
                    url.searchParams.append('fieldToggles', JSON.stringify(fieldToggles));

                    const response = await fetch(url.href, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                            'x-twitter-active-user': 'yes',
                            'x-csrf-token': csrfToken,
                            'User-Agent': navigator.userAgent,
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.status}`);
                    }

                    const data = await response.json();
                    console.log('Twitter API响应数据:', data);

                    // 解析响应数据，查找视频URL
                    const videoUrl = findVideoUrlInResponse(data, tweetId);
                    return videoUrl;

                } catch (error) {
                    console.error('调用Twitter API失败:', error);
                    return null;
                }
            }

            // 从cookie中获取csrf token
            function getCsrfToken() {
                const cookies = document.cookie.split(';');
                for (const cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name === 'ct0') {
                        return decodeURIComponent(value);
                    }
                }
                return null;
            }

            // 从Twitter API响应中查找最高质量的视频URL
            function findVideoUrlInResponse(data, tweetId) {
                try {
                    // 遵循Media Harvest的解析路径
                    // data.threaded_conversation_with_injections_v2.instructions
                    const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions;
                    if (!instructions || !Array.isArray(instructions)) {
                        console.log('未找到instructions');
                        return null;
                    }

                    // 找到TimelineAddEntries类型的instruction
                    const addEntriesInstruction = instructions.find(i => i.type === 'TimelineAddEntries');
                    if (!addEntriesInstruction || !Array.isArray(addEntriesInstruction.entries)) {
                        console.log('未找到TimelineAddEntries或entries');
                        return null;
                    }

                    // 找到包含目标tweetId的entry
                    const targetEntry = addEntriesInstruction.entries.find(e => e.entryId && e.entryId.includes(tweetId));
                    if (!targetEntry) {
                        console.log('未找到包含tweetId的entry:', tweetId);
                        return null;
                    }

                    // 获取tweet_results
                    const tweetResults = targetEntry.content?.itemContent?.tweet_results;
                    if (!tweetResults) {
                        console.log('未找到tweet_results');
                        return null;
                    }

                    // 获取legacy数据中的extended_entities.media
                    const legacy = tweetResults.result?.tweet?.legacy || tweetResults.result?.legacy;
                    const media = legacy?.extended_entities?.media;
                    if (!media || !Array.isArray(media)) {
                        console.log('未找到media');
                        return null;
                    }

                    // 遍历media找到视频
                    for (const mediaItem of media) {
                        if (mediaItem.type === 'video' || mediaItem.type === 'animated_gif') {
                            const videoInfo = mediaItem.video_info;
                            if (videoInfo && videoInfo.variants) {
                                // 查找所有mp4变体，选择最高码率的
                                const mp4Variants = videoInfo.variants.filter(v => v.content_type === 'video/mp4');
                                if (mp4Variants.length > 0) {
                                    // 按bitrate排序，选择最高的
                                    mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                                    const bestVariant = mp4Variants[0];

                                    console.log('选择的视频变体:', {
                                        url: bestVariant.url,
                                        bitrate: bestVariant.bitrate,
                                        content_type: bestVariant.content_type
                                    });

                                    return bestVariant.url;
                                }
                            }
                        }
                    }

                    console.log('未找到视频变体');
                    return null;

                } catch (error) {
                    console.error('解析视频URL失败:', error);
                    return null;
                }
            }

            // 设置网络监听器来捕获视频URL
            function setupNetworkListener(videoId, resolution, authorId, tweetId, tweetTime) {
                let captured = false;
                const timeout = 5000;

                // 重写fetch来拦截视频请求
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                    const url = args[0];

                    if (typeof url === 'string' && url.includes('video.twimg.com') && url.includes(videoId)) {
                        console.log('拦截到视频相关请求:', url);

                        // 检查是否是m3u8播放列表
                        if (url.includes('.m3u8') && !captured) {
                            // 异步处理m3u8解析
                            fetch(url)
                                .then(response => response.text())
                                .then(content => {
                                    if (captured) return;

                                    // 查找子播放列表
                                    const lines = content.split('\n');
                                    for (let i = 0; i < lines.length; i++) {
                                        const line = lines[i].trim();

                                        if (line.includes('RESOLUTION')) {
                                            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                                            const nextLine = lines[i + 1]?.trim();

                                            if (resMatch && nextLine && nextLine.includes('avc1')) {
                                                const subUrl = nextLine.startsWith('http')
                                                    ? nextLine
                                                    : `https://video.twimg.com${nextLine}`;

                                                // 获取子播放列表并查找mp4
                                                fetch(subUrl)
                                                    .then(r => r.text())
                                                    .then(subContent => {
                                                        if (captured) return;

                                                        const subLines = subContent.split('\n');
                                                        for (const subLine of subLines) {
                                                            if (subLine.includes('#EXT-X-MAP')) {
                                                                const uriMatch = subLine.match(/URI="([^"]+)"/);
                                                                if (uriMatch) {
                                                                    captured = true;
                                                                    window.fetch = originalFetch;

                                                                    const mp4Url = uriMatch[1].startsWith('http')
                                                                        ? uriMatch[1]
                                                                        : `https://video.twimg.com${uriMatch[1]}`;
                                                                    console.log('找到完整mp4 URL:', mp4Url);
                                                                    downloadVideo(mp4Url, videoId, resMatch[1], authorId, tweetId, tweetTime);
                                                                    return;
                                                                }
                                                            }
                                                        }
                                                    })
                                                    .catch(() => {});
                                                break;
                                            }
                                        }
                                    }
                                })
                                .catch(() => {});
                        }

                        // 检查是否是完整的mp4文件
                        if (url.includes('.mp4') && url.includes('/vid/') && !url.includes('.m4s') && !captured) {
                            captured = true;
                            window.fetch = originalFetch;
                            console.log('找到完整mp4 URL:', url);
                            downloadVideo(url, videoId, resolution, authorId, tweetId, tweetTime);
                        }
                    }

                    return originalFetch.apply(this, args);
                };

                // 设置超时恢复
                setTimeout(() => {
                    if (!captured) {
                        window.fetch = originalFetch;
                        console.log('监听超时，尝试直接访问推文页面');

                        // 方法3: 尝试访问推文页面获取视频信息
                        tryFetchTweetPage(videoId, resolution, authorId, tweetId, tweetTime);
                    }
                }, timeout);
            }

            // 尝试从推文页面获取视频信息
            async function tryFetchTweetPage(videoId, resolution, authorId, tweetId, tweetTime) {
                // 尝试访问TweetDetail的GraphQL API
                try {
                    // 从当前页面的数据中查找
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        const text = script.textContent;
                        if (text && text.includes('video_url') && text.includes(videoId)) {
                            // 尝试提取视频URL
                            const matches = text.match(/https:\/\/video\.twimg\.com\/amplify_video\/${videoId}\/[^"]+\.mp4/g);
                            if (matches && matches.length > 0) {
                                console.log('从页面数据找到视频URL:', matches[0]);
                                downloadVideo(matches[0], videoId, resolution, authorId, tweetId, tweetTime);
                                return;
                            }
                        }
                    }
                } catch (error) {
                    console.log('从页面获取视频信息失败:', error.message);
                }

                console.error('所有方法均失败，无法获取视频URL');
            }

            // 下载视频
            function downloadVideo(url, videoId, resolution, authorId, tweetId, tweetTime) {
                chrome.runtime.sendMessage({
                    action: "downloadVideo",
                    url: url,
                    videoId: videoId,
                    resolution: resolution,
                    authorId: authorId,
                    tweetId: tweetId,
                    tweetTime: tweetTime,
                    platform: 'twitter'
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('发送视频下载消息时发生错误:', chrome.runtime.lastError.message);
                    } else if (response && response.success) {
                        console.log(`视频下载成功 (${resolution})，ID:`, response.downloadId);
                    } else {
                        console.error(`视频下载失败 (${resolution})，错误:`, response ? response.error : '无响应');
                    }
                });
            }
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