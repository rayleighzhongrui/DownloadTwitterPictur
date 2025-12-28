// inject.js - 在 MAIN world 中运行，拦截 Twitter 的 GraphQL 请求
// 这是必要的，因为只有 MAIN world 才能真正拦截页面的 fetch 和 XMLHttpRequest

(function() {
    'use strict';

    console.log('[MAIN World] 正在设置 GraphQL 拦截器...');

    // 从 GraphQL 响应中提取视频数据
    function extractVideoDataFromResponse(response) {
        const videos = [];

        try {
            // 方法1: TweetResultByRestId 路径
            if (response.data?.tweetResult?.result) {
                const result = response.data.tweetResult.result;
                const tweetId = result.legacy?.id_str || result.rest_id;

                if (tweetId && result.legacy?.extended_entities?.media) {
                    const videoData = findBestVideoUrl(result.legacy.extended_entities.media, tweetId);
                    if (videoData) {
                        videos.push(videoData);
                    }
                }
            }

            // 方法2: TweetDetail 路径
            if (response.data?.threaded_conversation_with_injections_v2?.instructions) {
                const instructions = response.data.threaded_conversation_with_injections_v2.instructions;

                for (const instruction of instructions) {
                    if (instruction.type === 'TimelineAddEntries' && Array.isArray(instruction.entries)) {
                        for (const entry of instruction.entries) {
                            const tweetResult = entry.content?.itemContent?.tweet_results?.result;
                            if (tweetResult) {
                                const tweetId = tweetResult.legacy?.id_str || tweetResult.rest_id;
                                if (tweetId && tweetResult.legacy?.extended_entities?.media) {
                                    const videoData = findBestVideoUrl(tweetResult.legacy.extended_entities.media, tweetId);
                                    if (videoData) {
                                        videos.push(videoData);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[MAIN World] 提取视频数据失败:', e);
        }

        return videos;
    }

    // 从 media 数组中找到最佳质量的视频
    function findBestVideoUrl(media, tweetId) {
        if (!Array.isArray(media)) return null;

        for (const item of media) {
            if (item.type === 'video' || item.type === 'animated_gif') {
                const variants = item.video_info?.variants;
                if (!Array.isArray(variants) || variants.length === 0) continue;

                // 找到最高质量的 mp4 视频
                let bestVariant = null;
                let maxBitrate = 0;

                for (const variant of variants) {
                    if (variant.content_type === 'video/mp4' && variant.bitrate > maxBitrate) {
                        maxBitrate = variant.bitrate;
                        bestVariant = variant;
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
            // 检查是否是 TweetDetail 或 TweetResultByRestId 请求
            if ((this._url.includes('/TweetDetail') || this._url.includes('/TweetResultByRestId')) &&
                this._url.includes('/graphql/')) {

                this.addEventListener('load', function() {
                    if (this.status === 200) {
                        try {
                            const response = JSON.parse(this.responseText);
                            const videos = extractVideoDataFromResponse(response);

                            if (videos.length > 0) {
                                // 通过 CustomEvent 发送到 content script
                                videos.forEach(video => {
                                    const event = new CustomEvent('mh:video-captured', {
                                        detail: video
                                    });
                                    document.dispatchEvent(event);
                                    console.log('[MAIN World XHR] 拦截到视频:', video);
                                });
                            }
                        } catch (e) {
                            console.error('[MAIN World] 解析 XHR 响应失败:', e);
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
            // 检查是否是 TweetDetail 或 TweetResultByRestId 请求
            if ((url.includes('/TweetDetail') || url.includes('/TweetResultByRestId')) &&
                url.includes('/graphql/')) {

                return originalFetch.apply(this, args).then(async response => {
                    const clonedResponse = response.clone();

                    try {
                        const data = await clonedResponse.json();
                        const videos = extractVideoDataFromResponse(data);

                        if (videos.length > 0) {
                            // 通过 CustomEvent 发送到 content script
                            videos.forEach(video => {
                                const event = new CustomEvent('mh:video-captured', {
                                    detail: video
                                });
                                document.dispatchEvent(event);
                                console.log('[MAIN World fetch] 拦截到视频:', video);
                            });
                        }
                    } catch (e) {
                        console.error('[MAIN World] 解析 fetch 响应失败:', e);
                    }

                    return response;
                });
            }
        }

        return originalFetch.apply(this, args);
    };

    console.log('[MAIN World] GraphQL 拦截器设置完成 (XHR + fetch)');
})();
