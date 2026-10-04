export function findTweetContainer(eventTarget) {
  const likeButton = eventTarget.closest('[data-testid="like"]');
  if (!likeButton) return null;
  // 优先匹配标准推文 article，兜底匹配虚拟列表容器 cellInnerDiv
  return likeButton.closest('article[data-testid="tweet"]')
    || likeButton.closest('[data-testid="cellInnerDiv"]');
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
  const images = Array.from(container.querySelectorAll('img'))
    .filter(img => img.src && img.src.includes('pbs.twimg.com/media/'));

  const seen = new Set();
  return images.filter(img => {
    try {
      const url = new URL(img.src);
      const key = url.pathname;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return true;
    }
  });
}

export function extractTweetVideoComponents(container) {
  // videoComponent 覆盖普通视频播放器；GIF 等其它形态直接落在 <video> 元素上
  const components = new Set(
    Array.from(container.querySelectorAll('[data-testid="videoComponent"]'))
  );
  for (const video of container.querySelectorAll('video')) {
    components.add(video.closest('[data-testid="videoComponent"]') || video);
  }
  return Array.from(components);
}
