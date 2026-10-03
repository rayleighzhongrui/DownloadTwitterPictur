# 性能优化计划：WeakMap缓存 + 图片预加载

## 📊 性能分析总结

### 🔍 Pixiv 网站调研发现

通过 Playwright 实际调研，发现 Pixiv 的技术特征：

#### 技术栈
- **框架**: Next.js/React SPA（`__next` 根节点）
- **样式方案**: CSS-in-JS (styled-components)
- **类名特征**: 动态生成（如 `sc-5d3311e8-1 eAUPVa`），每次构建可能改变
- **页面复杂度**:
  - 详情页: **884 个 DOM 节点**，42 张图片
  - 推荐页: **2100 个 DOM 节点**，95 张图片

#### ⚠️ 为什么传统 DOM 缓存不适用 Pixiv

| 问题 | 说明 | 影响 |
|------|------|------|
| **动态类名** | CSS-in-JS 类名不稳定，无法作为缓存键 | ❌ 传统 CSS 选择器缓存失效 |
| **SPA 特性** | 路由切换不刷新页面 | ❌ 需要监听 URL 变化清理缓存 |
| **无稳定标识** | 大部分元素缺少 `data-testid` | ❌ 依赖属性选择器不可靠 |

### 🔴 高优先级问题

1. **Pixiv 检测器循环中的重复查询**（`pixiv-detector.js:85-137`）
   - 3个while循环，每个循环重复查询DOM
   - 每次点击收藏按钮触发 **15-20 次** `querySelectorAll`
   - 预计性能损失：10-15ms/次

2. **图片尺寸计算触发重排**（`pixiv-platform.js:90-104`）
   - `getBoundingClientRect()` 触发页面重排
   - 在筛选循环中频繁调用
   - 预计性能损失：5-8ms/张图片

3. **HEAD请求延迟**（twitter/pixiv platform）
   - 每张图片下载前发送HEAD请求验证
   - 增加网络往返时间（200-500ms）

### 🟠 中优先级问题

4. **页面级重复查询**（`pixiv-platform.js:32-47`）
5. **脚本标签遍历**（`twitter-platform.js:231-241`）

### 💡 优化策略选择

| 平台 | 推荐方案 | 原因 |
|------|----------|------|
| **Pixiv** | WeakMap + URL 监听 | 适应动态类名和 SPA 特性 |
| **Twitter** | 传统 DOM 缓存 + 预加载 | 有稳定的 `data-testid` 属性 |

---

## 🎯 优化目标

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| Pixiv检测响应时间 | 15-20ms | 3-5ms | **5x** |
| 图片下载启动延迟 | 200-500ms | 50-100ms | **4x** |
| DOM查询次数 | 每次点击15-20次 | 每次点击2-3次 | **6x** |
| 页面重排次数 | 5-10次 | 0-1次 | **10x** |

---

## 📁 文件修改清单

### 新增文件
- `src/utils/pixiv-dom-cache.js` - Pixiv WeakMap缓存管理器（针对 SPA）
- `src/utils/dom-cache.js` - 通用DOM缓存管理器（Twitter 使用）
- `src/utils/preloader.js` - 图片预加载器

### 修改文件
- `src/platforms/pixiv/pixiv-detector.js` - 使用 WeakMap 缓存
- `src/platforms/pixiv/pixiv-platform.js` - 使用 WeakMap 缓存
- `src/platforms/twitter/twitter-platform.js` - 使用 DOM 缓存 + 预加载
- `src/content.js` - 初始化缓存管理器

---

## 🔧 实施方案

## 优化1：Pixiv WeakMap 缓存（针对动态类名和 SPA）

### 核心思路

- ✅ **不依赖类名**：直接缓存 DOM 元素引用，而非 CSS 选择器
- ✅ **自动垃圾回收**：使用 `WeakMap` 避免内存泄漏
- ✅ **URL 监听清理**：监听 SPA 路由变化自动失效缓存
- ✅ **预查询优化**：一次性获取所有元素，循环内过滤

### 步骤1.1：创建 Pixiv WeakMap 缓存管理器

**文件：** `src/utils/pixiv-dom-cache.js`

```javascript
/**
 * Pixiv DOM 缓存管理器（针对 SPA 和动态类名）
 * 使用 WeakMap 自动管理内存，监听 URL 变化清理缓存
 */
export class PixivDOMCache {
  constructor() {
    // 使用 WeakMap 自动垃圾回收（键必须是对象）
    this.containerCache = new WeakMap();
    this.buttonCache = new WeakMap();
    this.lastUrl = window.location.href;
    this.setupUrlWatcher();
  }

  /**
   * 监听 SPA 路由变化（Pixiv 使用 Next.js）
   * 路由切换时自动清理缓存
   */
  setupUrlWatcher() {
    // 拦截 History API（SPA 路由导航）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.onUrlChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.onUrlChange();
    };

    // 监听浏览器前进/后退
    window.addEventListener('popstate', () => this.onUrlChange());
  }

  onUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      this.clear();
    }
  }

  /**
   * 缓存按钮到容器的映射
   * @param {Element} button - 收藏按钮元素
   * @param {Element} container - 作品容器元素
   */
  setContainer(button, container) {
    this.buttonCache.set(button, container);

    // 缓存容器的元数据
    this.containerCache.set(container, {
      images: Array.from(container.querySelectorAll('img')),
      links: Array.from(container.querySelectorAll('a[href*="/artworks/"]')),
      userLinks: Array.from(container.querySelectorAll('a[href*="/users/"]')),
      timestamp: Date.now()
    });
  }

  /**
   * 获取缓存的容器
   * @param {Element} button - 收藏按钮元素
   * @returns {Element|null} 容器元素
   */
  getContainer(button) {
    return this.buttonCache.get(button) || null;
  }

  /**
   * 获取容器的缓存元数据
   * @param {Element} container - 容器元素
   * @returns {Object|null} 缓存的元数据
   */
  getContainerMetadata(container) {
    return this.containerCache.get(container) || null;
  }

  /**
   * 清空所有缓存（WeakMap 会自动清理，但需要重置实例）
   */
  clear() {
    // WeakMap 无法手动清空，只能重新创建实例
    this.containerCache = new WeakMap();
    this.buttonCache = new WeakMap();
  }
}

// 导出单例
export const pixivCache = new PixivDOMCache();
```

### 步骤1.2：优化 Pixiv 检测器

**文件：** `src/platforms/pixiv/pixiv-detector.js`

**修改前：**
```javascript
// 第85-104行：重复查询DOM
while (current && current !== document.body && attempts < 8) {
  current = current.parentElement;
  attempts += 1;
  if (!current) break;

  // ❌ 每次循环都重新查询DOM
  const images = Array.from(current.querySelectorAll('img'));
  const artworkLinks = Array.from(current.querySelectorAll('a[href*="/artworks/"]'));
  const bookmarkButtons = Array.from(current.querySelectorAll('button[data-ga4-label="bookmark_button"]'));

  if (images.length > 0 && artworkLinks.length > 0 && bookmarkButtons.length === 1) {
    if (bookmarkButtons[0] === bookmarkButton || bookmarkButtons[0].contains(bookmarkButton)) {
      return current;
    }
  }
}
```

**修改后：**
```javascript
import { pixivCache } from '../../utils/pixiv-dom-cache.js';

export function findArtworkContainer(bookmarkButton) {
  // ✅ 优先使用缓存
  const cached = pixivCache.getContainer(bookmarkButton);
  if (cached) {
    return cached;
  }

  let container;
  if (isRecommendationFeed(bookmarkButton)) {
    container = findRecommendationArtworkContainer(bookmarkButton);
  } else {
    container = findFollowingArtworkContainer(bookmarkButton);
  }

  // ✅ 缓存结果（按钮 → 容器映射）
  if (container) {
    pixivCache.setContainer(bookmarkButton, container);
  }

  return container;
}

function findRecommendationArtworkContainer(bookmarkButton) {
  // ✅ 一次性查询所有需要的元素（使用最快的 API）
  const allImages = document.getElementsByTagName('img');
  const allLinks = document.querySelectorAll('a[href*="/artworks/"]');
  const allButtons = document.querySelectorAll('button[data-ga4-label="bookmark_button"]');

  let current = bookmarkButton;
  let attempts = 0;

  // 第一个循环：标准检测
  while (current && current !== document.body && attempts < 8) {
    current = current.parentElement;
    attempts++;

    if (!current) break;

    // ✅ 从预获取的集合中过滤，而非重新查询 DOM
    const images = filterContained(allImages, current);
    const links = filterContained(allLinks, current);
    const buttons = filterContained(allButtons, current);

    if (images.length > 0 && links.length > 0 && buttons.length === 1) {
      if (buttons[0] === bookmarkButton || buttons[0].contains(bookmarkButton)) {
        return current;
      }
    }
  }

  // 第二个循环：data-ga4-entity-id 检测
  current = bookmarkButton;
  attempts = 0;
  while (current && current !== document.body && attempts < 8) {
    current = current.parentElement;
    attempts++;

    if (!current) break;
    const entityId = current.getAttribute('data-ga4-entity-id');
    if (entityId && entityId.startsWith('illust/')) {
      const images = filterContained(allImages, current);
      const links = filterContained(allLinks, current);
      if (images.length > 0 && links.length > 0) {
        return current;
      }
    }
  }

  // 第三个循环：宽松检测
  current = bookmarkButton;
  attempts = 0;
  while (current && current !== document.body && attempts < 5) {
    current = current.parentElement;
    attempts++;
    if (!current) break;

    const images = filterContained(allImages, current);
    const links = filterContained(allLinks, current);
    if (images.length > 0 && links.length > 0 && links.length <= 2) {
      return current;
    }
  }

  return findFollowingArtworkContainer(bookmarkButton);
}

// 辅助函数：从全局集合中过滤属于容器的元素
function filterContained(nodeList, container) {
  return Array.from(nodeList).filter(el => container.contains(el));
}
```

### 步骤1.3：优化 Pixiv 平台

**文件：** `src/platforms/pixiv/pixiv-platform.js`

**修改点：**

```javascript
import { pixivCache } from '../../utils/pixiv-dom-cache.js';
import { findArtworkContainer, findPixivBookmarkButton } from './pixiv-detector.js';

export class PixivPlatform extends BasePlatform {
  constructor({ downloader, retryManager }) {
    super({ name: 'pixiv', downloader, retryManager });
    this.proxyManager = new ProxyManager();
  }

  async handleAction(event) {
    const bookmarkButton = findPixivBookmarkButton(event.target);
    if (!bookmarkButton) return false;

    await this.proxyManager.load();

    // ✅ 使用缓存获取容器
    const container = findArtworkContainer(bookmarkButton);
    if (!container) return false;

    // ✅ 使用缓存的元数据
    const metadata = pixivCache.getContainerMetadata(container);

    const url = window.location.href;
    let illustId;
    let authorId = 'unknown_author';
    let authorName = 'unknown_author_name';
    let images = [];
    let totalImages = 1;

    if (url.startsWith('https://www.pixiv.net/artworks/')) {
      illustId = url.match(/artworks\/(\d+)/)?.[1] || 'unknown_id';

      // ✅ 使用缓存的用户链接
      if (metadata && metadata.userLinks.length > 0) {
        const userLink = metadata.userLinks[0];
        authorId = userLink.href.match(/users\/(\d+)/)?.[1] || 'unknown_author';
        authorName = userLink.textContent.trim();
      } else {
        // 降级：直接查询
        const authorLinkElement = container.querySelector('a[href*="/users/"]');
        if (authorLinkElement) {
          authorId = authorLinkElement.href.match(/users\/(\d+)/)?.[1] || 'unknown_author';
          authorName = authorLinkElement.textContent.trim();
        }
      }

      // ✅ 使用缓存的图片
      if (metadata && metadata.images.length > 0) {
        images = metadata.images;
      } else {
        images = Array.from(container.querySelectorAll('img'));
      }

      // 检测多图作品
      if (images.length > 1) {
        totalImages = images.length;
      } else {
        // 查找页面指示器
        const pageIndicator = container.querySelector('[data-gtm-value]');
        if (pageIndicator) {
          const match = pageIndicator.textContent.match(/(\d+)\/(\d+)/);
          if (match) totalImages = parseInt(match[2], 10);
        }
      }
    } else {
      // 推荐页等场景
      const artworkLink = container.querySelector('a[href*="/artworks/"]');
      if (artworkLink) {
        illustId = artworkLink.href.match(/artworks\/(\d+)/)?.[1] || 'unknown_id';
      }
      images = metadata ? metadata.images : Array.from(container.querySelectorAll('img'));
    }

    // 后续下载逻辑...
  }
}
```

---

## 优化2：Twitter 图片预加载（针对稳定的 `data-testid`）

### 核心思路

- ✅ **鼠标悬停预加载**：用户悬停在推文上 300ms 后自动预加载
- ✅ **HEAD 请求验证**：不下载图片，只验证 URL 可访问性
- ✅ **缓存预加载结果**：避免重复请求
- ✅ **快速下载启动**：点击后直接使用预加载结果

### 步骤2.1：创建预加载管理器

**文件：** `src/utils/preloader.js`

```javascript
/**
 * 图片预加载管理器
 * 在用户点击前提前验证图片 URL
 */
export class ImagePreloader {
  constructor() {
    this.preloadCache = new Map(); // 预加载结果缓存
    this.preloadQueue = new Set(); // 预加载队列
    this.hoverDelay = 300; // 鼠标悬停延迟（毫秒）
    this.hoverTimer = null;
  }

  /**
   * 设置鼠标悬停预加载
   * @param {string} selector - 目标元素选择器
   * @param {Function} extractor - 提取图片URL的函数
   */
  setupHoverPreload(selector, extractor) {
    let lastTarget = null;

    document.addEventListener('mouseover', (event) => {
      const target = event.target.closest(selector);
      if (!target || target === lastTarget) return;

      lastTarget = target;

      // 清除之前的定时器
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
      }

      // 延迟预加载（避免快速滑动时频繁触发）
      this.hoverTimer = setTimeout(() => {
        const urls = extractor(target);
        if (urls && urls.length > 0) {
          urls.forEach(url => this.preload(url));
        }
      }, this.hoverDelay);
    }, true);

    document.addEventListener('mouseout', (event) => {
      if (this.hoverTimer && event.target.closest(selector) === lastTarget) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
        lastTarget = null;
      }
    }, true);
  }

  /**
   * 预加载单个图片（HEAD请求验证）
   * @param {string} url - 图片URL
   * @returns {Promise<boolean>} 是否成功
   */
  async preload(url) {
    if (this.preloadCache.has(url)) {
      return this.preloadCache.get(url);
    }

    if (this.preloadQueue.has(url)) {
      return; // 已在队列中
    }

    this.preloadQueue.add(url);

    try {
      const response = await fetch(url, { method: 'HEAD' });
      const success = response.ok;
      this.preloadCache.set(url, success);
      return success;
    } catch (error) {
      this.preloadCache.set(url, false);
      return false;
    } finally {
      this.preloadQueue.delete(url);
    }
  }

  /**
   * 检查URL是否已预加载
   * @param {string} url - 图片URL
   * @returns {boolean|null} null=未加载, true=成功, false=失败
   */
  isPreloaded(url) {
    return this.preloadCache.get(url);
  }

  /**
   * 清空预加载缓存
   */
  clear() {
    this.preloadCache.clear();
    this.preloadQueue.clear();
  }
}
```

### 步骤2.2：在 Twitter 平台集成预加载

**文件：** `src/platforms/twitter/twitter-platform.js`

**修改点：**

```javascript
import { ImagePreloader } from '../../utils/preloader.js';

export class TwitterPlatform extends BasePlatform {
  constructor({ downloader, retryManager }) {
    super({ name: 'twitter', downloader, retryManager });
    this.tweetVideoCache = new Map();

    // ✅ 添加预加载器
    this.preloader = new ImagePreloader();
    this.setupPreloader();
  }

  setupPreloader() {
    // 监听推文上的鼠标悬停，预加载图片
    this.preloader.setupHoverPreload('[data-testid="tweet"]', (tweetElement) => {
      const images = tweetElement.querySelectorAll('img');
      return Array.from(images).map(img => {
        const url = new URL(img.src);
        url.searchParams.set('name', 'orig');
        return url.toString();
      });
    });
  }

  async handleAction(event) {
    const tweetContainer = findTweetContainer(event.target);
    if (!tweetContainer) return false;

    const { authorId, tweetId, tweetTime } = extractTweetMetadata(tweetContainer);
    const images = extractTweetImages(tweetContainer);

    for (const img of images) {
      const imgUrl = new URL(img.src);
      imgUrl.searchParams.set('name', 'orig');
      const urlStr = imgUrl.toString();

      // ✅ 检查是否已预加载
      const preloaded = this.preloader.isPreloaded(urlStr);

      try {
        if (preloaded === true) {
          // 已预加载成功，直接下载
          await this.downloader.downloadImage({
            url: urlStr,
            metadata: { ...metadata, platform: 'twitter' }
          });
        } else if (preloaded === null) {
          // 未预加载，正常流程
          await this.downloadImage(urlStr, { authorId, tweetId, tweetTime });
        } else {
          // 预加载失败，跳过
          console.warn('预加载失败，跳过:', urlStr);
        }
      } catch (error) {
        await this.handleError(error, { action: 'downloadImage', url: urlStr });
      }
    }

    // ... 视频处理逻辑
  }
}
```

### 步骤2.3：在 ContentScript 中初始化

**文件：** `src/content.js`

```javascript
import { ConfigManager } from './core/config.js';
import { Downloader } from './core/downloader.js';
import { RetryManager } from './utils/retry.js';
import { TwitterPlatform } from './platforms/twitter/twitter-platform.js';
import { PixivPlatform } from './platforms/pixiv/pixiv-platform.js';
// Pixiv WeakMap 缓存自动初始化，无需显式导入

class ContentScript {
  constructor() {
    this.platforms = new Map();
    this.config = new ConfigManager();
    this.downloader = new Downloader();
    this.retryManager = new RetryManager();
    this.handleClick = this.handleClick.bind(this);
  }

  async init() {
    const switches = await this.config.getSwitches();
    this.updatePlatforms(switches);
    document.addEventListener('click', this.handleClick, true);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.twitterSwitchActive || changes.pixivSwitchActive) {
        const twitterSwitchActive = changes.twitterSwitchActive
          ? changes.twitterSwitchActive.newValue
          : this.platforms.has('twitter');
        const pixivSwitchActive = changes.pixivSwitchActive
          ? changes.pixivSwitchActive.newValue
          : this.platforms.has('pixiv');
        this.updatePlatforms({ twitterSwitchActive, pixivSwitchActive });
      }
    });
  }

  updatePlatforms({ twitterSwitchActive, pixivSwitchActive }) {
    if (twitterSwitchActive) {
      if (!this.platforms.has('twitter')) {
        this.platforms.set('twitter', new TwitterPlatform({
          downloader: this.downloader,
          retryManager: this.retryManager
        }));
      }
    } else {
      this.platforms.delete('twitter');
    }

    if (pixivSwitchActive) {
      if (!this.platforms.has('pixiv')) {
        this.platforms.set('pixiv', new PixivPlatform({
          downloader: this.downloader,
          retryManager: this.retryManager
        }));
      }
    } else {
      this.platforms.delete('pixiv');
    }
  }

  async handleClick(event) {
    for (const platform of this.platforms.values()) {
      if (!platform.detectAction(event)) continue;
      try {
        await platform.handleAction(event);
      } catch (error) {
        await platform.handleError(error, { action: 'handleAction' });
      }
      break;
    }
  }
}

new ContentScript().init();
```

---

## 🧪 测试计划

### 测试场景

#### Pixiv WeakMap 缓存测试
1. **Pixiv 推荐页测试**
   - 打开 https://www.pixiv.net/bookmark_new_illust.php
   - 快速点击 5 个不同的收藏按钮
   - 测量响应时间（应 < 3ms）
   - 检查缓存命中率（应 > 85%）

2. **Pixiv 详情页测试**
   - 打开任意作品详情页
   - 点击收藏按钮
   - 检查 DOM 查询次数（应 < 3 次）

3. **SPA 路由测试**
   - 在 Pixiv 站内导航（详情页 → 推荐页 → 详情页）
   - 验证路由切换后缓存是否清理
   - 检查内存是否泄漏

#### Twitter 预加载测试
1. **Twitter 悬停预加载**
   - 打开 Twitter 时间线
   - 鼠标悬停在推文上 300ms
   - 点击点赞按钮
   - 测量下载启动时间（应 < 100ms）

2. **Twitter 缓存测试**
   - 多次点击同一推文的点赞按钮
   - 验证预加载结果复用

### 性能基准

| 场景 | 优化前 | 优化后（WeakMap） | 测试方法 |
|------|--------|-----------------|----------|
| Pixiv 检测响应 | 15-20ms | < 3ms | `performance.now()` |
| Pixiv DOM 查询 | 15-20 次 | < 3 次 | 代码计数 |
| Twitter 下载启动 | 200-500ms | < 100ms | 网络 timing |
| 缓存命中率 | 0% | 85-95% | 统计日志 |
| 内存占用 | 基准 | +1-2MB | DevTools |

---

## 📊 预期收益

### 性能提升
- ✅ **Pixiv 检测速度提升 7x**（15-20ms → <3ms）
- ✅ **DOM 查询次数减少 80%**（15-20 次 → <3 次）
- ✅ **Twitter 下载启动速度提升 4x**（200-500ms → <100ms）
- ✅ **缓存命中率 85-95%**

### 用户体验
- ✅ 点击响应更灵敏
- ✅ 下载启动更快速
- ✅ 页面滚动更流畅
- ✅ CPU 占用降低

### 代码质量
- ✅ 针对不同平台使用最优策略
- ✅ WeakMap 自动内存管理
- ✅ 更好的可测试性
- ✅ 更容易维护和扩展

---

## ⚠️ 注意事项

### WeakMap 缓存注意事项（Pixiv）
1. **WeakMap 限制**：
   - 键必须是对象，不能用字符串
   - 不可遍历，无法获取大小
   - 需要配合 URL 监听使用

2. **SPA 路由监听**：
   - 必须拦截 `history.pushState/replaceState`
   - 监听 `popstate` 事件（浏览器前进/后退）
   - URL 变化时自动清理缓存

3. **内存管理**：
   - WeakMap 自动垃圾回收，无需手动清理
   - DOM 元素被移除后，缓存自动释放
   - 不会造成内存泄漏

### 预加载注意事项（Twitter）
1. **网络流量**：预加载会增加带宽消耗（每次约 1-2KB HEAD 请求）
2. **延迟设置**：鼠标悬停延迟不宜过短（建议 300ms）
3. **缓存限制**：预加载缓存应有大小限制（建议 100 个 URL）

### 兼容性
- ✅ Chrome Extension Manifest V3
- ✅ WeakMap: Chrome 36+
- ✅ IntersectionObserver: Chrome 51+（如果使用）
- ✅ ES2020+ 语法

---

## 🚀 实施步骤

### 阶段1：Pixiv WeakMap 缓存（必须）⭐⭐⭐⭐⭐
1. ✅ 创建 `src/utils/pixiv-dom-cache.js`
2. ✅ 修改 `src/platforms/pixiv/pixiv-detector.js` 使用 WeakMap 缓存
3. ✅ 修改 `src/platforms/pixiv/pixiv-platform.js` 使用缓存的元数据
4. ✅ 测试 Pixiv 推荐页、详情页、SPA 路由切换
5. ✅ 性能基准测试（缓存命中率、响应时间）
6. ✅ 内存泄漏测试（长时间使用）
7. ✅ 运行 `npm run build` 重新构建

**预计耗时**: 2-3 小时
**性能提升**: 7x（Pixiv 检测速度）

### 阶段2：Twitter 图片预加载（推荐）⭐⭐⭐⭐
1. ✅ 创建 `src/utils/preloader.js`
2. ✅ 修改 `src/platforms/twitter/twitter-platform.js` 集成预加载
3. ✅ 测试悬停预加载功能
4. ✅ 性能基准测试（下载启动时间）
5. ✅ 运行 `npm run build` 重新构建

**预计耗时**: 1-2 小时
**性能提升**: 4x（Twitter 下载启动速度）

### 阶段3：验证和优化（可选）⭐⭐⭐
1. ✅ 端到端测试（Pixiv + Twitter）
2. ✅ 添加性能监控日志
3. ✅ 代码审查
4. ✅ 更新文档

**预计耗时**: 1 小时

**总计时间：4-6 小时**

---

## 📝 后续优化建议

完成当前优化后，可考虑：
1. **事件委托优化** - 使用 `requestIdleCallback` 延迟处理点击事件
2. **IntersectionObserver 延迟加载** - Pixiv 推荐页的无限滚动优化
3. **请求去重** - 防止重复下载同一图片
4. **批量下载队列** - 管理大量下载任务
5. **性能监控面板** - 实时查看缓存命中率和性能指标

---

## 📚 参考资料

- [Pixiv 实际调研报告](https://www.pixiv.net) - 使用 Playwright 分析页面结构
- [WeakMap MDN 文档](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
- [Next.js SPA 路由监听](https://nextjs.org/docs/api-reference/next/router)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)

---

**文档版本**：v2.0
**创建日期**：2025-01-15
**更新日期**：2025-12-28
**负责人**：开发团队

**更新内容**：
- ✅ 添加 Pixiv 网站实际调研结果
- ✅ 改用 WeakMap + URL 监听方案（适应动态类名和 SPA）
- ✅ 针对 Pixiv 和 Twitter 使用不同的优化策略
- ✅ 更新性能基准和测试计划
- ✅ 调整实施步骤和预计时间
