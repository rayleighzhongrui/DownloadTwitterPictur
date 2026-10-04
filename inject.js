// inject.js - 在 MAIN world 中运行，拦截 Twitter 的 GraphQL 请求
// 这是必要的，因为只有 MAIN world 才能真正拦截页面的 fetch 和 XMLHttpRequest

(function() {
    'use strict';

    console.log('[MAIN World] 正在设置 GraphQL 拦截器...');

    // tweetId -> 视频数据 的本地缓存。
    // 作用：
    // 1. CustomEvent.detail 无法从 MAIN world 传递到 ISOLATED world（扩展隔离环境），
    //    必须改用 window.postMessage 通信
    // 2. GraphQL 响应可能早于 content script 初始化完成，
    //    content script 启动后会发送 mh:request-videos 拉取这份缓存补齐
    const videoCache = new Map();
    const MAX_VIDEO_CACHE = 1000;

    function postToContentScript(type, payload) {
        window.postMessage({ source: 'mh-inject', type, payload }, '*');
    }

    function rememberAndEmit(videoData) {
        videoCache.set(videoData.tweetId, videoData);
        if (videoCache.size > MAX_VIDEO_CACHE) {
            // Map 按插入序遍历，淘汰最旧条目
            videoCache.delete(videoCache.keys().next().value);
        }
        postToContentScript('mh:video-captured', videoData);
        console.log('[MAIN World] 捕获到视频:', videoData);
    }

    // 响应 content script 的快照拉取请求
    window.addEventListener('message', function(event) {
        const data = event.data;
        if (!data || data.source !== 'mh-content' || data.type !== 'mh:request-videos') return;
        postToContentScript('mh:video-snapshot', Array.from(videoCache.values()));
    });

    // 从 GraphQL 响应中提取视频数据
    // 采用递归遍历，兼容 TweetDetail / TweetResultByRestId / HomeTimeline / UserTweets 等任意端点的响应结构
    function extractVideoDataFromResponse(response) {
        const videos = [];

        try {
            collectTweetVideos(response, videos, 0);
        } catch (e) {
            console.error('[MAIN World] 提取视频数据失败:', e);
        }

        return videos;
    }

    // 递归遍历响应树，找出所有带视频/动图媒体的推文
    function collectTweetVideos(node, videos, depth) {
        if (!node || typeof node !== 'object' || depth > 40) return;
        if (Array.isArray(node)) {
            for (const item of node) collectTweetVideos(item, videos, depth + 1);
            return;
        }

        const legacy = node.legacy;
        if (legacy && Array.isArray(legacy.extended_entities?.media)) {
            const tweetId = legacy.id_str || node.rest_id;
            if (tweetId) {
                const videoData = findBestVideoUrl(legacy.extended_entities.media, tweetId);
                if (videoData) {
                    videos.push(videoData);
                }
            }
        }

        for (const key of Object.keys(node)) {
            const value = node[key];
            if (value && typeof value === 'object') {
                collectTweetVideos(value, videos, depth + 1);
            }
        }
    }

    // 从 media 数组中找到最佳质量的视频
    function findBestVideoUrl(media, tweetId) {
        if (!Array.isArray(media)) return null;

        for (const item of media) {
            if (item.type === 'video' || item.type === 'animated_gif') {
                const variants = item.video_info?.variants;
                if (!Array.isArray(variants) || variants.length === 0) continue;

                // 找到最高质量的 mp4 视频
                // 注意：GIF (animated_gif) 的变体 bitrate 通常为 0，必须用 >= 比较，否则永远选不中
                let bestVariant = null;
                let maxBitrate = -1;

                for (const variant of variants) {
                    if (variant.content_type === 'video/mp4') {
                        const bitrate = variant.bitrate || 0;
                        if (!bestVariant || bitrate >= maxBitrate) {
                            bestVariant = variant;
                            maxBitrate = bitrate;
                        }
                    }
                }

                if (bestVariant) {
                    // 尝试从 URL 中提取分辨率信息
                    const url = bestVariant.url;
                    const resolution = extractResolution(url);

                    return {
                        tweetId: tweetId,
                        videoUrl: url,
                        resolution: resolution || 'unknown',
                        timestamp: Date.now()
                    };
                }
            }
        }

        return null;
    }

    // 从视频 URL 中提取分辨率信息
    function extractResolution(url) {
        const match = url.match(/(\d+)x(\d+)\//);
        return match ? `${match[1]}x${match[2]}` : null;
    }

    // 拦截 XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        return originalOpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function(...args) {
        if (this._url && typeof this._url === 'string') {
            // 拦截所有 GraphQL 响应：时间线（HomeTimeline 等）、详情页等任何含推文媒体的接口
            if (this._url.includes('/graphql/')) {

                this.addEventListener('load', function() {
                    if (this.status === 200) {
                        try {
                            // responseType 为 'json' 时读 responseText 会抛 DOMException，
                            // 必须直接读 this.response
                            let response = null;
                            const responseType = this.responseType;
                            if (responseType === '' || responseType === 'text') {
                                response = JSON.parse(this.responseText);
                            } else if (responseType === 'json') {
                                response = this.response;
                            }

                            if (response && typeof response === 'object') {
                                const videos = extractVideoDataFromResponse(response);
                                videos.forEach(rememberAndEmit);
                            }
                        } catch (e) {
                            // 部分 GraphQL 端点返回流式/非 JSON 内容，跳过即可
                            console.log('[MAIN World] 跳过无法解析的 XHR 响应:', e && e.message);
                        }
                    }
                });
            }
        }
        return originalSend.apply(this, args);
    };

    // 拦截 fetch API
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

        if (url && typeof url === 'string') {
            // 拦截所有 GraphQL 响应：时间线（HomeTimeline 等）、详情页等任何含推文媒体的接口
            if (url.includes('/graphql/')) {

                return originalFetch.apply(this, args).then(async response => {
                    try {
                        // 只解析 JSON 响应，跳过错误页/流式/空响应体
                        const contentType = response.headers.get('content-type') || '';
                        if (response.ok && contentType.includes('json')) {
                            const data = await response.clone().json();
                            const videos = extractVideoDataFromResponse(data);
                            videos.forEach(rememberAndEmit);
                        }
                    } catch (e) {
                        console.log('[MAIN World] 跳过无法解析的 fetch 响应:', e && e.message);
                    }

                    return response;
                });
            }
        }

        return originalFetch.apply(this, args);
    };

    console.log('[MAIN World] GraphQL 拦截器设置完成 (XHR + fetch)');
})();
