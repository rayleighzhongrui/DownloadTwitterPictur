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
  if (isRecommendationFeed(bookmarkButton)) {
    return findRecommendationArtworkContainer(bookmarkButton);
  }
  return findFollowingArtworkContainer(bookmarkButton);
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
  let current = bookmarkButton;
  let attempts = 0;

  while (current && current !== document.body && attempts < 8) {
    current = current.parentElement;
    attempts += 1;

    if (!current) break;

    const images = Array.from(current.querySelectorAll('img'));
    const artworkLinks = Array.from(current.querySelectorAll('a[href*="/artworks/"]'));
    const bookmarkButtons = Array.from(current.querySelectorAll('button[data-ga4-label="bookmark_button"]'));

    if (images.length > 0 && artworkLinks.length > 0 && bookmarkButtons.length === 1) {
      if (bookmarkButtons[0] === bookmarkButton || bookmarkButtons[0].contains(bookmarkButton)) {
        return current;
      }
    }
  }

  current = bookmarkButton;
  attempts = 0;
  while (current && current !== document.body && attempts < 8) {
    current = current.parentElement;
    attempts += 1;

    if (!current) break;
    const entityId = current.getAttribute('data-ga4-entity-id');
    if (entityId && entityId.startsWith('illust/')) {
      const images = Array.from(current.querySelectorAll('img'));
      const artworkLinks = Array.from(current.querySelectorAll('a[href*="/artworks/"]'));
      if (images.length > 0 && artworkLinks.length > 0) {
        return current;
      }
    }
  }

  current = bookmarkButton;
  attempts = 0;
  while (current && current !== document.body && attempts < 5) {
    current = current.parentElement;
    attempts += 1;
    if (!current) break;

    const images = Array.from(current.querySelectorAll('img'));
    const artworkLinks = Array.from(current.querySelectorAll('a[href*="/artworks/"]'));
    if (images.length > 0 && artworkLinks.length > 0 && artworkLinks.length <= 2) {
      return current;
    }
  }

  return findFollowingArtworkContainer(bookmarkButton);
}
