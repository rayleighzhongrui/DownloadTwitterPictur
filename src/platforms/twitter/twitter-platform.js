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
        if (attempt === 2) {
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
        return;
      }
    } catch (error) {
      console.log('Twitter API方法失败:', error.message);
    }

    const resources = performance.getEntriesByType('resource');
    for (const resource of resources) {
      if (resource.name.includes('video.twimg.com') &&
        resource.name.includes('amplify_video') &&
        resource.name.includes(videoId) &&
        resource.name.includes('.mp4') &&
        !resource.name.includes('.m4s')) {
        await this.downloadVideo(resource.name, { resolution, ...metadata });
        return;
      }
    }

    this.setupNetworkListener(videoId, resolution, metadata);
  }

  setupNetworkListener(videoId, resolution, metadata) {
    let captured = false;
    const timeout = 5000;
    const originalFetch = window.fetch;

    window.fetch = (...args) => {
      const url = args[0];
      if (typeof url === 'string' && url.includes('video.twimg.com') && url.includes(videoId)) {
        if (url.includes('.m3u8') && !captured) {
          originalFetch.call(window, url)
            .then(response => response.text())
            .then(content => {
              if (captured) return;
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i += 1) {
                const line = lines[i].trim();
                if (line.includes('RESOLUTION')) {
                  const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                  const nextLine = lines[i + 1]?.trim();
                  if (resMatch && nextLine && nextLine.includes('avc1')) {
                    const subUrl = nextLine.startsWith('http')
                      ? nextLine
                      : `https://video.twimg.com${nextLine}`;
                    originalFetch.call(window, subUrl)
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
                              this.downloadVideo(mp4Url, { resolution: resMatch[1], ...metadata })
                                .catch(error => this.handleError(error, { action: 'downloadVideo', url: mp4Url }));
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

        if (url.includes('.mp4') && url.includes('/vid/') && !url.includes('.m4s') && !captured) {
          captured = true;
          window.fetch = originalFetch;
          this.downloadVideo(url, { resolution, ...metadata })
            .catch(error => this.handleError(error, { action: 'downloadVideo', url }));
        }
      }
      return originalFetch.apply(window, args);
    };

    setTimeout(() => {
      if (!captured) {
        window.fetch = originalFetch;
        this.tryFetchTweetPage(videoId, resolution, metadata);
      }
    }, timeout);
  }

  async tryFetchTweetPage(videoId, resolution, metadata) {
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent;
        if (text && text.includes('video_url') && text.includes(videoId)) {
          const matches = text.match(new RegExp(`https://video\\.twimg\\.com/amplify_video/${videoId}/[^"]+\\.mp4`, 'g'));
          if (matches && matches.length > 0) {
            await this.downloadVideo(matches[0], { resolution, ...metadata });
            return;
          }
        }
      }
    } catch (error) {
      console.log('从页面获取视频信息失败:', error.message);
    }
  }
}
