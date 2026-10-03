import { BasePlatform } from '../base-platform.js';
import { findPixivBookmarkButton, findArtworkContainer } from './pixiv-detector.js';
import { fetchIllustMeta, fetchIllustPages } from './pixiv-api.js';
import { ProxyManager } from '../../core/proxy-manager.js';
import { pixivCache } from '../../utils/pixiv-dom-cache.js';

const ILLUST_ID_RE = /\/artworks\/(\d+)/;
const DEBUG = false; // 生产环境关闭详细调试日志

// 提取作品 ID：
// 1. DOM 缓存里的 artwork 链接
// 2. 当前页 URL 路径（详情页）
// 3. 兜底扫描 document 全局的 artwork 链接（推荐流容器可能不含链接）
function extractIllustId(target, metadata) {
  const fromLink = metadata?.links?.[0]?.href.match(ILLUST_ID_RE)?.[1];
  if (fromLink) return fromLink;
  const fromTarget = target?.href?.match(ILLUST_ID_RE)?.[1];
  if (fromTarget) return fromTarget;
  const fromUrl = window.location.pathname.match(ILLUST_ID_RE)?.[1];
  if (fromUrl) return fromUrl;
  // 最后兜底：页面任意 artwork 链接
  const anyLink = document.querySelector('a[href*=”/artworks/”]');
  if (anyLink) {
    const m = anyLink.href.match(ILLUST_ID_RE);
    if (m) return m[1];
  }
  return null;
}

export class PixivPlatform extends BasePlatform {
  constructor({ downloader, retryManager, proxyManager }) {
    super({ name: 'pixiv', downloader, retryManager });
    // 允许外部注入，便于测试；否则按需实例化
    this.proxyManager = proxyManager || new ProxyManager();
  }

  detectAction(event) {
    return Boolean(findPixivBookmarkButton(event.target));
  }

  async handleAction(event) {
    const bookmarkButton = findPixivBookmarkButton(event.target);
    if (!bookmarkButton) {
      if (DEBUG) console.log('[Pixiv] detector miss', {
        target: event.target,
        targetTag: event.target?.tagName,
        targetAria: event.target?.getAttribute?.('aria-label'),
        targetClass: event.target?.className
      });
      return false;
    }

    if (DEBUG) console.log('[Pixiv] handleAction start', bookmarkButton);

    await this.proxyManager.load();

    const container = findArtworkContainer(bookmarkButton);
    const metadata = container ? pixivCache.getContainerMetadata(container) : null;

    const illustId = extractIllustId(bookmarkButton, metadata);
    if (DEBUG) console.log('[Pixiv] illustId =', illustId);
    if (!illustId) {
      await this.handleError(new Error('未找到 illustId'), { action: 'detectIllustId' });
      return false;
    }

    let meta;
    let pages;
    try {
      [meta, pages] = await Promise.all([
        fetchIllustMeta(illustId),
        fetchIllustPages(illustId).catch(err => {
          if (DEBUG) console.log('[Pixiv] /pages failed, fallback to meta.originalUrl:', err.message);
          return null;
        })
      ]);
      // 单图兜底：/pages 挂了但 meta 里有原图 URL
      if (!pages && meta?.originalUrl) {
        pages = [{ urls: { original: meta.originalUrl } }];
      }
      if (DEBUG) console.log('[Pixiv] api ok', { author: meta?.userName, pageCount: pages?.length });
    } catch (error) {
      if (DEBUG) console.log('[Pixiv] api failed:', error.message, error);
      await this.handleError(error, { action: 'fetchIllustMeta', url: `illust/${illustId}` });
      return false;
    }

    if (!pages || pages.length === 0) {
      await this.handleError(new Error('作品无可下载页面'), { action: 'fetchIllustPages', url: `illust/${illustId}/pages` });
      return false;
    }

    const fileMeta = {
      authorId: String(meta.userId || 'unknown_author'),
      authorName: meta.userName || 'unknown_author_name',
      illustId: String(meta.illustId || illustId),
      pageTotal: pages.length
    };

    for (let i = 0; i < pages.length; i += 1) {
      const originalUrl = pages[i].urls?.original;
      if (!originalUrl) continue;
      try {
        await this.downloadWithFallback(originalUrl, {
          ...fileMeta,
          pageIndex: i + 1
        });
      } catch (error) {
        await this.handleError(error, { action: 'downloadImage', url: originalUrl });
      }
    }

    return true;
  }

  // 图片下载走反代优先：i.pximg.net 有防盗链（校验 Referer），
  // content script 里对它的 HEAD 请求是跨域 fetch，必然被 CORS 拦截。
  // 反代（Cloudflare Worker）服务端带 Referer 转发并返回 CORS 头，是可靠路径。
  // 反代失败时才回退原图直连（chrome.downloads 的下载不受 CORS 限制）。
  async downloadWithFallback(originalUrl, metadata) {
    const tried = new Set();
    const proxyDomain = this.proxyManager.getProxyDomain();
    const candidates = proxyDomain && proxyDomain !== 'YOUR_PROXY_DOMAIN_HERE'
      ? [this.replaceDomain(originalUrl, proxyDomain), originalUrl]
      : [originalUrl];

    let lastError;
    for (const url of candidates) {
      if (tried.has(url)) continue;
      tried.add(url);
      try {
        await this.downloadImage(url, metadata);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('所有下载源均失败');
  }

  replaceDomain(url, domain) {
    const parsed = new URL(url);
    parsed.hostname = domain;
    return parsed.toString();
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

    await this.retryManager.retry(() => attemptDownload(url), {
      name: 'Pixiv图片下载',
      onRetry: ({ attempt }) => {
        if (attempt === 1) {
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
