import { BasePlatform } from '../base-platform.js';
import { findPixivBookmarkButton, findArtworkContainer } from './pixiv-detector.js';
import { fetchIllustMeta, fetchIllustPages } from './pixiv-api.js';
import { ProxyManager } from '../../core/proxy-manager.js';
import { getPlatformForHost } from '../../core/platform-host.js';
import { mapLimit } from '../../utils/concurrency.js';
import { t } from '../../utils/i18n.js';

const DOWNLOAD_CONCURRENCY = 3;

const ILLUST_ID_RE = /^\/(?:[a-z]{2}\/)?artworks\/(\d+)(?:\/|$)/;
const DEBUG = false; // 生产环境关闭详细调试日志

function idFromLink(link) {
  if (!link?.href) return null;
  try {
    const url = new URL(link.href, window.location.href);
    return getPlatformForHost(url.hostname) === 'pixiv'
      ? url.pathname.match(ILLUST_ID_RE)?.[1] || null
      : null;
  } catch {
    return null;
  }
}

// 只从点击目标关联的信息取 ID，不扫描全页首链接猜测作品。
function extractIllustId(target, container) {
  // 只有明确的主作品按钮才能使用详情 URL；推荐区不能借用主作品 ID。
  if (target.classList.contains('gtm-main-bookmark')) {
    return window.location.pathname.match(ILLUST_ID_RE)?.[1] || null;
  }
  const fromTarget = idFromLink(target.closest('a[href*="/artworks/"]'));
  if (fromTarget) return fromTarget;

  if (container && container !== document.body) {
    // SPA 可能复用卡片节点并替换链接，不能使用旧的 metadata.links 快照。
    const ids = new Set(Array.from(container.querySelectorAll('a[href*="/artworks/"]'))
      .map(idFromLink).filter(Boolean));
    if (ids.size === 1) return ids.values().next().value;
    if (ids.size > 1) return null;
    // 无链接卡片可以用自身实体 ID；不能借用包住整个详情页的实体属性。
    const entity = target.closest('[data-ga4-entity-id^="illust/"]');
    if (entity && container.contains(entity)) {
      return entity.getAttribute('data-ga4-entity-id').match(/^illust\/(\d+)$/)?.[1] || null;
    }
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
    const illustId = extractIllustId(bookmarkButton, container);
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

    // 多页限流并发：单页失败不中断整批，进度按完成数上报
    let completedPages = 0;
    await mapLimit(pages, DOWNLOAD_CONCURRENCY, async (page, i) => {
      const originalUrl = page.urls?.original;
      if (originalUrl) {
        try {
          await this.downloadWithFallback(originalUrl, {
            ...fileMeta,
            pageIndex: i + 1
          });
        } catch (error) {
          await this.handleError(error, { action: 'downloadImage', url: originalUrl });
        }
      }
      completedPages += 1;
      this.sendBatchProgress(`pixiv:${fileMeta.illustId}`, completedPages, pages.length);
    });

    return true;
  }

  // 图片下载走反代优先：i.pximg.net 有防盗链（校验 Referer），
  // content script 里对它的 HEAD 请求是跨域 fetch，必然被 CORS 拦截。
  // 反代（Cloudflare Worker）服务端带 Referer 转发并返回 CORS 头，是可靠路径。
  // 反代失败时由后台带 Referer 获取原图，再交给 chrome.downloads 落盘。
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
      // 不用 content-script 的跨域 HEAD 阻断直连；由后台 fetch + downloads
      // 处理 Referer 和原图字节，下载中断仍由 downloads.onChanged 统一记录。
      if (new URL(imageUrl).hostname !== 'i.pximg.net') {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
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
            title: t('notifRetryTitle', [], '下载重试中'),
            message: t('notifRetryPixiv', [], 'Pixiv 图片正在重试…')
          });
        }
      }
    });
  }
}
