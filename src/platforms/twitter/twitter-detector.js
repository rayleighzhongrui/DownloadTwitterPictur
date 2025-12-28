export function findTweetContainer(eventTarget) {
  const likeButton = eventTarget.closest('[data-testid="like"]');
  if (!likeButton) return null;
  return likeButton.closest('[data-testid="cellInnerDiv"]');
}

export function extractTweetMetadata(container) {
  let authorId = 'unknown_author';
  const usernameSpans = container.querySelectorAll('[data-testid="User-Name"] span');
  usernameSpans.forEach(span => {
    const textContent = span.textContent.trim();
    if (textContent.includes('@')) {
      authorId = textContent;
    }
  });

  const tweetId = container.querySelector('a[href*="/status/"]')?.href.match(/status\/(\d+)/)?.[1]
    || 'unknown_tweet_id';

  let tweetTime = 'unknown_time';
  const timeElement = container.querySelector('time');
  if (timeElement) {
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      const date = new Date(datetime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      tweetTime = `${year}${month}${day}`;
    }
  }

  return { authorId, tweetId, tweetTime };
}

export function extractTweetImages(container) {
  return Array.from(container.querySelectorAll('img'))
    .filter(img => img.src && img.src.includes('pbs.twimg.com/media/'));
}

export function extractTweetVideoComponents(container) {
  return Array.from(container.querySelectorAll('[data-testid="videoComponent"]'));
}
