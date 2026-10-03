import { pixivCache } from '../../utils/pixiv-dom-cache.js';

// Pixiv 收藏按钮可能使用的标识：aria-label / title / data 属性 / class 关键字
const BOOKMARK_HINTS = [
  // 日文
  'ブックマークに追加',
  'ブックマーク済み',
  'ブックマーク解除',
  // 中文
  '收藏',
  '已收藏',
  '取消收藏',
  '添加收藏',
  // 英文
  'bookmark',
  'Bookmark',
  'add bookmark',
  'remove bookmark',
  'Add to bookmarks'
];

function matchesBookmarkHint(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return BOOKMARK_HINTS.some(hint => lower.includes(hint.toLowerCase()));
}

function isBookmarkElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (matchesBookmarkHint(el.getAttribute?.('aria-label'))) return true;
  if (matchesBookmarkHint(el.getAttribute?.('title'))) return true;
  if (matchesBookmarkHint(el.getAttribute?.('data-ga4-label'))) return true;
  const cls = el.className && typeof el.className === 'string' ? el.className : '';
  if (/bookmark/i.test(cls)) return true;
  return false;
}

export function findPixivBookmarkButton(target) {
  // 1. 自身或祖先节点带 bookmark 提示
  let el = target;
  while (el && el !== document.body) {
    if (isBookmarkElement(el)) {
      // 找到 button/role=button；如果不是交互元素，找其内层按钮
      if (el.tagName === 'BUTTON' || el.getAttribute?.('role') === 'button') return el;
      const inner = el.querySelector?.('button, [role="button"]');
      if (inner && isBookmarkElement(inner)) return inner;
      // 祖先本身就被识别为 bookmark 区域时返回它（platform 会找最近的 artwork 链接）
      return el;
    }
    el = el.parentElement;
  }

  // 2. 旧选择器兜底（早期 Pixiv 版本）
  let button = target.closest('[data-ga4-label="bookmark_button"]');
  if (button) return button;

  // 3. 启发式：最近的 button 且不是 follow
  button = target.closest('button');
  if (button && isLikelyBookmarkButton(button)) return button;

  return null;
}

function isLikelyBookmarkButton(button) {
  // 排除明显的“关注”按钮
  const buttonText = button.textContent.trim();
  const isFollowButton = buttonText.includes('关注') || buttonText.includes('フォロー') || buttonText.includes('follow');
  if (isFollowButton) return false;
  // 必须有 svg 图标
  if (!button.querySelector('svg')) return false;
  return true;
}

export function findArtworkContainer(bookmarkButton) {
  const cached = pixivCache.getContainer(bookmarkButton);
  if (cached) {
    return cached;
  }

  // 详情页场景：整个 document.body 都是作品的渲染容器，
  // 直接返回 document.body 让 platform 用 URL 路径提取 illustId。
  if (window.location.pathname.startsWith('/artworks/')) {
    return document.body;
  }

  let container;
  if (isRecommendationFeed(bookmarkButton)) {
    container = findRecommendationArtworkContainer(bookmarkButton);
  } else {
    container = findFollowingArtworkContainer(bookmarkButton);
  }

  if (container) {
    pixivCache.setContainer(bookmarkButton, container);
  }

  return container;
}

function isRecommendationFeed(bookmarkButton) {
  const workContentContainer = bookmarkButton.closest('[data-ga4-label="work_content"]');
  if (workContentContainer) {
    return true;
  }

  const container = bookmarkButton.closest('div');
  if (!container) return false;

  const hasRecommendationText = container.textContent.includes('其他作品') ||
    container.textContent.includes('的其他作品') ||
    container.querySelector('[class*="recommend"], [class*="suggest"]');

  const bookmarkButtonsCount = container.querySelectorAll('button[data-ga4-label="bookmark_button"]').length;
  const hasMultipleBookmarks = bookmarkButtonsCount > 3;

  const mainImg = container.querySelector('img');
  const isLargeImage = mainImg && (mainImg.offsetWidth > 300 || mainImg.offsetHeight > 300);

  return Boolean(hasRecommendationText || hasMultipleBookmarks || isLargeImage);
}

function findFollowingArtworkContainer(bookmarkButton) {
  let container = bookmarkButton.closest('li');
  if (container && container.querySelector('img') && container.querySelector('a[href*="/artworks/"]')) {
    return container;
  }

  const scContainers = ['[class*="sc-"]', '[class*="gtm-"]'];
  for (const selector of scContainers) {
    container = bookmarkButton.closest(selector);
    if (container && container.querySelector('img') && container.querySelector('a[href*="/artworks/"]')) {
      return container;
    }
  }

  let current = bookmarkButton.parentElement;
  while (current && current !== document.body) {
    const hasImage = current.querySelector('img');
    const hasLink = current.querySelector('a[href*="/artworks/"]');
    if (hasImage && hasLink) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function findRecommendationArtworkContainer(bookmarkButton) {
  const allImages = Array.from(document.getElementsByTagName('img'));
  const allLinks = Array.from(document.querySelectorAll('a[href*="/artworks/"]'));
  const allButtons = Array.from(document.querySelectorAll('button[data-ga4-label="bookmark_button"]'));

  let current = bookmarkButton;
  let attempts = 0;

  while (current && current !== document.body && attempts < 8) {
    current = current.parentElement;
    attempts += 1;

    if (!current) break;

    const imageCount = countContained(allImages, current, 1);
    const linkCount = countContained(allLinks, current, 3);
    const buttonInfo = countButtons(allButtons, current, bookmarkButton, 2);

    if (imageCount > 0 && linkCount > 0 && buttonInfo.count === 1 && buttonInfo.matches) {
      return current;
    }

    const entityId = current.getAttribute('data-ga4-entity-id');
    if (entityId && entityId.startsWith('illust/')) {
      if (imageCount > 0 && linkCount > 0) {
        return current;
      }
    }

    if (imageCount > 0 && linkCount > 0 && linkCount <= 2) {
      return current;
    }
  }

  return findFollowingArtworkContainer(bookmarkButton);
}

function countContained(nodes, container, maxCount) {
  let count = 0;
  for (const node of nodes) {
    if (!container.contains(node)) continue;
    count += 1;
    if (maxCount && count >= maxCount) break;
  }
  return count;
}

function countButtons(nodes, container, targetButton, maxCount) {
  let count = 0;
  let matches = false;
  for (const node of nodes) {
    if (!container.contains(node)) continue;
    count += 1;
    if (node === targetButton || node.contains(targetButton)) {
      matches = true;
    }
    if (maxCount && count >= maxCount) break;
  }
  return { count, matches };
}
