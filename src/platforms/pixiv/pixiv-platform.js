import { BasePlatform } from '../base-platform.js';
import { findPixivBookmarkButton, findArtworkContainer } from './pixiv-detector.js';
import { buildOriginalImageUrl } from './pixiv-api.js';
import { ProxyManager } from '../../core/proxy-manager.js';

export class PixivPlatform extends BasePlatform {
  constructor({ downloader, retryManager }) {
    super({ name: 'pixiv', downloader, retryManager });
    this.proxyManager = new ProxyManager();
  }

  detectAction(event) {
    return Boolean(findPixivBookmarkButton(event.target));
  }

  async handleAction(event) {
    const bookmarkButton = findPixivBookmarkButton(event.target);
    if (!bookmarkButton) return false;

    await this.proxyManager.load();

    const url = window.location.href;
    let illustId;
    let authorId = 'unknown_author';
    let authorName = 'unknown_author_name';
    let images = [];
    let totalImages = 1;

    if (url.startsWith('https://www.pixiv.net/artworks/')) {
      illustId = url.match(/artworks\/(\d+)/)?.[1] || 'unknown_id';

      const authorLinkElement = document.querySelector('a[href*="/users/"]');
      if (authorLinkElement) {
        authorId = authorLinkElement.href.match(/users\/(\d+)/)?.[1] || 'unknown_author';
        authorName = authorLinkElement.textContent.trim();
        if (!authorName || authorName.includes('查看') || authorName.includes('更多') || authorName.length > 50) {
          const authorImg = authorLinkElement.querySelector('img');
          if (authorImg && authorImg.alt && !authorImg.alt.includes('的插画')) {
            authorName = authorImg.alt.trim();
          }
        }
      }

      const mainImage = document.querySelector('main img');
      if (mainImage) {
        images = [mainImage];
        const pageIndicator = document.querySelector('[data-gtm-value]');
        if (pageIndicator) {
          const match = pageIndicator.textContent.match(/(\d+)\/(\d+)/);
          if (match) totalImages = parseInt(match[2], 10);
        }
      }
    } else {
      const artworkContainer = findArtworkContainer(bookmarkButton);
      if (artworkContainer) {
        const artworkLinks = artworkContainer.querySelectorAll('a[href*="/artworks/"]');
        let mainArtworkLink = null;

        if (artworkLinks.length > 1) {
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
        } else {
          illustId = artworkContainer.querySelector('[data-gtm-value]')?.getAttribute('data-gtm-value');
        }

        const authorLink = artworkContainer.querySelector('a[href*="/users/"]');
        if (authorLink) {
          authorId = authorLink.href.match(/users\/(\d+)/)?.[1] || 'unknown_author';
          authorName = authorLink.textContent.trim();
          if (!authorName || authorName.includes('查看') || authorName.includes('更多') || authorName.length > 50) {
            const authorImg = authorLink.querySelector('img');
            if (authorImg && authorImg.alt && !authorImg.alt.includes('的插画')) {
              authorName = authorImg.alt.trim();
            }
          }
        }

        const allImages = Array.from(artworkContainer.querySelectorAll('img'));
        let mainImage = null;

        if (allImages.length > 1) {
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
          const multiImageIndicator = artworkContainer.querySelector('[class*="sc-"], span');
          if (multiImageIndicator) {
            const match = multiImageIndicator.textContent.match(/(\d+)/);
            if (match && parseInt(match[1], 10) > 1) {
              totalImages = parseInt(match[1], 10);
            }
          }
        }
      }
    }

    if (images.length === 0) {
      return false;
    }

    for (const img of images) {
      if (!img?.src) continue;
      const result = buildOriginalImageUrl(img.src, this.proxyManager.getProxyDomain(), illustId);
      if (!result) {
        continue;
      }
      await this.downloadImageSeries(result.url, result.illustId, totalImages, {
        authorId,
        authorName,
        illustId: result.illustId
      });
    }

    return true;
  }

  replaceDomain(url, domain) {
    const parsed = new URL(url);
    parsed.hostname = domain;
    return parsed.toString();
  }

  async downloadImageSeries(baseUrl, illustId, totalImages, metadata) {
    for (let index = 0; index < totalImages; index += 1) {
      const url = baseUrl.replace('_p0', `_p${index}`);
      try {
        await this.downloadWithProxies(url, {
          ...metadata,
          illustId
        });
      } catch (error) {
        await this.handleError(error, {
          action: 'downloadImage',
          url,
          retryCount: this.retryManager?.maxRetries || 0
        });
      }
      chrome.runtime.sendMessage({
        action: 'downloadProgress',
        current: index + 1,
        total: totalImages,
        platform: 'pixiv'
      });
    }
  }

  async downloadWithProxies(url, metadata) {
    // 直接使用硬编码的代理域名
    const proxyDomain = this.proxyManager.getProxyDomain();
    const proxyUrl = this.replaceDomain(url, proxyDomain);

    // 使用重试管理器下载（保留重试功能）
    await this.downloadImage(proxyUrl, metadata);
  }

  async downloadImage(url, metadata) {
    const attemptDownload = async (imageUrl) => {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      await this.downloader.downloadImage({
        url: imageUrl,
        metadata: { ...metadata, platform: 'pixiv' }
      });
    };

    if (!this.retryManager) {
      await attemptDownload(url);
      return;
    }

    try {
      await this.retryManager.retry(() => attemptDownload(url), {
        name: 'Pixiv图片下载',
        onRetry: ({ attempt }) => {
          if (attempt === 2) {
            chrome.runtime.sendMessage({
              action: 'notify',
              level: 'warning',
              title: '下载重试中',
              message: 'Pixiv图片正在重试...'
            });
          }
        }
      });
    } catch (error) {
      const retryUrl = url.endsWith('.png')
        ? url.replace('.png', '.jpg')
        : url.endsWith('.jpg')
          ? url.replace('.jpg', '.png')
          : null;
      if (!retryUrl) {
        throw error;
      }
      await this.retryManager.retry(() => attemptDownload(retryUrl), {
        name: 'Pixiv图片下载',
        onRetry: ({ attempt }) => {
          if (attempt === 2) {
            chrome.runtime.sendMessage({
              action: 'notify',
              level: 'warning',
              title: '下载重试中',
              message: 'Pixiv图片正在重试...'
            });
          }
        }
      });
    }
  }
}
