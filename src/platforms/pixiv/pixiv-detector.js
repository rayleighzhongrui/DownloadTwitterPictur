import { pixivCache } from '../../utils/pixiv-dom-cache.js';

export function findPixivBookmarkButton(target) {
  let button = target.closest('[class*="bookmark"]');
  if (button) return button;

  button = target.closest('[data-ga4-label="bookmark_button"]');
  if (button) return button;

  button = target.closest('button');
  if (button && isLikelyBookmarkButton(button)) {
    return button;
  }

  return null;
}

function isLikelyBookmarkButton(button) {
  const container = button.closest('li, [class*="sc-"], div');
  if (!container) return false;

  const hasImage = container.querySelector('img');
  const hasArtworkLink = container.querySelector('a[href*="/artworks/"], a[href*="/users/"]');
  const hasIcon = button.querySelector('svg, img');
  const buttonText = button.textContent.trim();
  const isFollowButton = buttonText.includes('关注') || buttonText.includes('フォロー') || buttonText.includes('follow');

  return hasImage && hasArtworkLink && hasIcon && !isFollowButton;
}

export function findArtworkContainer(bookmarkButton) {
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
