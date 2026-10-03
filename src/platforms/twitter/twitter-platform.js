import { BasePlatform } from '../base-platform.js';
import { findTweetContainer, extractTweetMetadata, extractTweetImages, extractTweetVideoComponents } from './twitter-detector.js';
import { fetchVideoUrlFromTwitterAPI } from './twitter-api.js';

export class TwitterPlatform extends BasePlatform {
  constructor({ downloader, retryManager }) {
    super({ name: 'twitter', downloader, retryManager });
    this.tweetVideoCache = new Map();
    document.addEventListener('mh:video-captured', event => {
      const videoData = event.detail;
      if (videoData && videoData.tweetId && videoData.videoUrl) {
        this.tweetVideoCache.set(videoData.tweetId, {
          videoUrl: videoData.videoUrl,
          resolution: videoData.resolution,
          timestamp: Date.now()
        });
      }
    });
  }

  detectAction(event) {
    return Boolean(findTweetContainer(event.target));
  }

  async handleAction(event) {
    const tweetContainer = findTweetContainer(event.target);
    if (!tweetContainer) return false;

    const { authorId, tweetId, tweetTime } = extractTweetMetadata(tweetContainer);
    const images = extractTweetImages(tweetContainer);

    for (const img of images) {
      const imgUrl = new URL(img.src);
      imgUrl.searchParams.set('name', 'orig');
      try {
        await this.downloadImage(imgUrl.toString(), { authorId, tweetId, tweetTime });
      } catch (error) {
        await this.handleError(error, { action: 'downloadImage', url: imgUrl.toString() });
      }
    }

    const videoComponents = extractTweetVideoComponents(tweetContainer);
    for (const videoComponent of videoComponents) {
      const video = videoComponent.querySelector('video');
      if (!video || !video.poster) continue;

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

      const posterMatch = video.poster.match(/amplify_video_thumb\/(\d+)\//);
      if (!posterMatch) continue;

      const videoId = posterMatch[1];
      const resolution = `${video.videoWidth}x${video.videoHeight}`;
      try {
        await this.attemptVideoDownload(videoId, resolution, { authorId, tweetId, tweetTime });
      } catch (error) {
        await this.handleError(error, { action: 'downloadVideo', url: video.poster });
      }
    }

    return true;
  }

  getVideoUrlFromCache(tweetId) {
    const cached = this.tweetVideoCache.get(tweetId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp < 3600000) {
      return cached;
    }
    this.tweetVideoCache.delete(tweetId);
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

  async attemptVideoDownload(videoId, resolution, metadata) {
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
      }
    } catch (error) {
      // GraphQL 拿不到时只记录，不再死磕页面脚本（不可靠且会污染 fetch）
      console.log('Twitter API 方法失败:', error.message);
    }
  }
}
