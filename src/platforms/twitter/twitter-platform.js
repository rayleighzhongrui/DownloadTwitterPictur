import { BasePlatform } from '../base-platform.js';
import { findTweetContainer, extractTweetMetadata, extractTweetImages, extractTweetVideoComponents } from './twitter-detector.js';
import { fetchVideoUrlFromTwitterAPI } from './twitter-api.js';

// 模块级视频缓存：跨平台实例共享，用户开关 Twitter 功能时不丢失已捕获的数据
const tweetVideoCache = new Map();

function cacheVideoData(videoData) {
  // 只接受 Twitter 视频 CDN 的地址，防止页面内其它脚本伪造消息注入任意下载地址
  if (videoData && videoData.tweetId
    && typeof videoData.videoUrl === 'string'
    && videoData.videoUrl.startsWith('https://video.twimg.com/')) {
    tweetVideoCache.set(videoData.tweetId, {
      videoUrl: videoData.videoUrl,
      resolution: videoData.resolution,
      timestamp: Date.now()
    });
  }
}

// inject.js 运行在 MAIN world：CustomEvent.detail 跨 world 会丢失，
// 必须通过 window.postMessage 通信（Chrome 官方推荐的页面 <-> 扩展桥接方式）
if (typeof window !== 'undefined') {
  window.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.source !== 'mh-inject') return;

    if (data.type === 'mh:video-captured') {
      cacheVideoData(data.payload);
    } else if (data.type === 'mh:video-snapshot') {
      (data.payload || []).forEach(item => cacheVideoData(item));
    }
  });
}

export class TwitterPlatform extends BasePlatform {
  constructor({ downloader, retryManager }) {
    super({ name: 'twitter', downloader, retryManager });

    // 拉取 inject.js 在 content script 启动前捕获的视频快照，弥补初始化时序竞争
    window.postMessage({ source: 'mh-content', type: 'mh:request-videos' }, '*');
  }

  detectAction(event) {
    return Boolean(findTweetContainer(event.target));
  }

  async handleAction(event) {
    const tweetContainer = findTweetContainer(event.target);
    if (!tweetContainer) return false;

    const { authorId, tweetId, tweetTime } = extractTweetMetadata(tweetContainer);
    const images = extractTweetImages(tweetContainer);

    for (let i = 0; i < images.length; i += 1) {
      const img = images[i];
      const imgUrl = new URL(img.src);
      imgUrl.searchParams.set('name', 'orig');
      try {
        await this.downloadImage(imgUrl.toString(), {
          authorId,
          tweetId,
          tweetTime,
          pageIndex: i + 1,
          pageTotal: images.length
        });
      } catch (error) {
        await this.handleError(error, { action: 'downloadImage', url: imgUrl.toString() });
      }
    }

    const videoComponents = extractTweetVideoComponents(tweetContainer);
    for (const videoComponent of videoComponents) {
      // GIF 播放器可能本身就是 <video> 元素（无 videoComponent 容器）
      const video = videoComponent.tagName === 'VIDEO'
        ? videoComponent
        : videoComponent.querySelector('video');
      if (!video) continue;

      const cachedVideo = this.getVideoUrlFromCache(tweetId);
      if (cachedVideo) {
        try {
          await this.downloadVideo(cachedVideo.videoUrl, {
            resolution: cachedVideo.resolution,
            authorId,
            tweetId,
            tweetTime
          });
        } catch (error) {
          await this.handleError(error, { action: 'downloadVideo', url: cachedVideo.videoUrl });
        }
        continue;
      }

      // 未播放时 videoWidth 可能为 0，此时不上分辨率后缀
      const resolution = video.videoWidth
        ? `${video.videoWidth}x${video.videoHeight}`
        : null;
      try {
        await this.attemptVideoDownload({ authorId, tweetId, tweetTime }, resolution, video);
      } catch (error) {
        await this.handleError(error, { action: 'downloadVideo', url: video.poster || video.src || '' });
      }
    }

    return true;
  }

  getVideoUrlFromCache(tweetId) {
    const cached = tweetVideoCache.get(tweetId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp < 3600000) {
      return cached;
    }
    tweetVideoCache.delete(tweetId);
    return null;
  }

  async downloadImage(url, metadata) {
    if (!this.retryManager) {
      await this.downloader.downloadImage({ url, metadata: { ...metadata, platform: 'twitter' } });
      return;
    }

    await this.retryManager.retry(async () => {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      await this.downloader.downloadImage({ url, metadata: { ...metadata, platform: 'twitter' } });
    }, {
      name: 'Twitter图片下载',
      onRetry: ({ attempt }) => {
        if (attempt === 1) {
          chrome.runtime.sendMessage({
            action: 'notify',
            level: 'warning',
            title: '下载重试中',
            message: 'Twitter图片正在重试...'
          });
        }
      }
    });
  }

  async downloadVideo(url, metadata) {
    await this.downloader.downloadVideo({
      url,
      metadata: { ...metadata, platform: 'twitter' }
    });
  }

  async attemptVideoDownload(metadata, resolution = null, videoEl = null) {
    const cachedVideo = this.getVideoUrlFromCache(metadata.tweetId);
    if (cachedVideo) {
      await this.downloadVideo(cachedVideo.videoUrl, {
        resolution: cachedVideo.resolution,
        ...metadata
      });
      return;
    }

    try {
      const videoUrl = await fetchVideoUrlFromTwitterAPI(metadata.tweetId);
      if (videoUrl) {
        await this.downloadVideo(videoUrl, { resolution, ...metadata });
        return;
      }
    } catch (error) {
      // GraphQL 拿不到时只记录（queryId 可能已过期）
      console.log('Twitter API 方法失败:', error.message);
    }

    // 最后兜底：GIF 等场景下 video 元素本身就是可直连的 mp4 地址（非 blob 流）
    const src = videoEl?.currentSrc || videoEl?.src || '';
    if (/^https?:/.test(src) && src.includes('video.twimg.com')) {
      await this.downloadVideo(src, { resolution, ...metadata });
    }
  }
}
