/**
 * Pixiv DOM cache for SPA pages with unstable class names.
 * Uses WeakMap for automatic GC and clears cache on URL changes.
 */
export class PixivDOMCache {
  constructor() {
    this.containerCache = new WeakMap();
    this.buttonCache = new WeakMap();
    this.lastUrl = window.location.href;
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalQueries: 0
    };
    this.setupUrlWatcher();
  }

  setupUrlWatcher() {
    if (this.urlObserver) return;

    this.urlObserver = new MutationObserver(() => {
      this.onUrlChange();
    });

    this.urlObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener('popstate', () => this.onUrlChange());
  }

  onUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      this.resetStats();
    }
  }

  setContainer(button, container) {
    this.buttonCache.set(button, container);
    this.containerCache.set(container, {
      images: Array.from(container.querySelectorAll('img')),
      links: Array.from(container.querySelectorAll('a[href*="/artworks/"]')),
      userLinks: Array.from(container.querySelectorAll('a[href*="/users/"]')),
      timestamp: Date.now()
    });
  }

  getContainer(button) {
    this.stats.totalQueries += 1;
    const container = this.buttonCache.get(button) || null;
    if (!container) {
      this.stats.cacheMisses += 1;
      return null;
    }

    if (!document.body.contains(container)) {
      this.buttonCache.delete(button);
      this.stats.cacheMisses += 1;
      return null;
    }

    this.stats.cacheHits += 1;
    return container;
  }

  getContainerMetadata(container) {
    if (!container || !document.body.contains(container)) {
      if (container) {
        this.containerCache.delete(container);
      }
      return null;
    }

    return this.containerCache.get(container) || null;
  }

  clear() {
    this.containerCache = new WeakMap();
    this.buttonCache = new WeakMap();
    this.resetStats();
  }

  resetStats() {
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
    this.stats.totalQueries = 0;
  }

  getStats() {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      ...this.stats,
      hitRate: total ? this.stats.cacheHits / total : 0
    };
  }
}

export const pixivCache = new PixivDOMCache();
