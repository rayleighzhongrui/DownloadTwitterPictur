import { pixivCache } from '../../utils/pixiv-dom-cache.js';
import { getPlatformForHost } from '../../core/platform-host.js';

const BOOKMARK_HINTS = [
  'ブックマークに追加', 'ブックマーク済み', 'ブックマーク解除',
  '收藏', '已收藏', '取消收藏', '添加收藏',
  'bookmark', 'add bookmark', 'remove bookmark', 'add to bookmarks'
];

function isBookmarkElement(element) {
  if (!element || element.nodeType !== 1) return false;
  const hints = ['aria-label', 'title', 'data-ga4-label'].map(name => element.getAttribute(name) || '');
  hints.push(typeof element.className === 'string' ? element.className : '');
  return hints.some(text => BOOKMARK_HINTS.some(hint => text.toLowerCase().includes(hint.toLowerCase())));
}

export function findPixivBookmarkButton(target) {
  if (getPlatformForHost(window.location.hostname) !== 'pixiv') return null;
  const element = target?.nodeType === 1 ? target : target?.parentElement;
  const button = element?.closest?.('button, [role="button"]');
  if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return null;

  // 只接受控件内明确标识，不借用 bookmark-list 等页面级祖先的名称。
  let current = element;
  while (current) {
    if (isBookmarkElement(current)) return button;
    if (current === button) break;
    current = current.parentElement;
  }
  if (button.parentElement?.getAttribute('data-ga4-label') === 'bookmark_button') return button;

  // 已在真实推荐卡片验证的 32px 心形路径；不泛化为“含 SVG 即收藏”。
  const heartPrefix = 'M21,5.5C24.8659932,5.528,8.6340067528,12.5C28,18.2694439';
  const hasPixivHeart = Array.from(button.querySelectorAll('svg[viewBox="0 0 32 32"] path[d]'))
    .some(path => path.getAttribute('d').replace(/\s+/g, '').startsWith(heartPrefix));
  return hasPixivHeart ? button : null;
}

export function findArtworkContainer(bookmarkButton) {
  const cached = pixivCache.getContainer(bookmarkButton);
  if (cached) return cached;

  // 从最近父节点向外找关联，而不是依赖不稳定的 sc-* 类名或 <img>。
  // Pixiv 缩略图也可能用 figure/CSS 背景或懒加载占位符。
  let current = bookmarkButton.parentElement;
  while (current && current !== document.body) {
    const hasArtworkLink = current.querySelector('a[href*="/artworks/"]');
    const entityId = current.getAttribute('data-ga4-entity-id');
    if (hasArtworkLink || /^illust\/\d+$/.test(entityId || '')) {
      let bookmarks = 0;
      for (const control of current.querySelectorAll('button, [role="button"]')) {
        if (findPixivBookmarkButton(control) === control) bookmarks += 1;
        // 已越过单一卡片边界，不再把整片推荐流当成点击作品。
        if (bookmarks > 1) return null;
      }
      pixivCache.setContainer(bookmarkButton, current);
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
