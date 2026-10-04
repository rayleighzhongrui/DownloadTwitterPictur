import { describe, it, expect, vi } from 'vitest';
import { TwitterPlatform } from '../src/platforms/twitter/twitter-platform.js';

function makePlatform() {
  return new TwitterPlatform({ downloader: {}, retryManager: null });
}

describe('TwitterPlatform 与 inject.js 的 postMessage 桥接', () => {
  it('通过 mh:video-captured 消息接收视频数据并写入缓存', async () => {
    const platform = makePlatform();

    window.postMessage({
      source: 'mh-inject',
      type: 'mh:video-captured',
      payload: {
        tweetId: '2106383896673947652',
        videoUrl: 'https://video.twimg.com/tweet_video/abc.mp4',
        resolution: '480x480'
      }
    }, '*');

    await vi.waitFor(() => {
      expect(platform.getVideoUrlFromCache('2106383896673947652')).toBeTruthy();
    });

    const cached = platform.getVideoUrlFromCache('2106383896673947652');
    expect(cached.videoUrl).toBe('https://video.twimg.com/tweet_video/abc.mp4');
    expect(cached.resolution).toBe('480x480');
  });

  it('构造时请求快照并接收 mh:video-snapshot 回放（GIF 场景）', async () => {
    // 模拟 inject.js 响应快照请求
    window.addEventListener('message', event => {
      if (event.data?.source === 'mh-content' && event.data?.type === 'mh:request-videos') {
        window.postMessage({
          source: 'mh-inject',
          type: 'mh:video-snapshot',
          payload: [
            { tweetId: '111', videoUrl: 'https://video.twimg.com/a.mp4', resolution: '720x720' },
            { tweetId: '222', videoUrl: 'https://video.twimg.com/tweet_video/gif.mp4', resolution: 'unknown' }
          ]
        }, '*');
      }
    });

    const platform = makePlatform();

    await vi.waitFor(() => {
      expect(platform.getVideoUrlFromCache('222')).toBeTruthy();
    });
    expect(platform.getVideoUrlFromCache('111').videoUrl).toBe('https://video.twimg.com/a.mp4');
    expect(platform.getVideoUrlFromCache('222').videoUrl).toBe('https://video.twimg.com/tweet_video/gif.mp4');
  });

  it('忽略来源不明的消息，不污染缓存', async () => {
    const platform = makePlatform();

    window.postMessage({
      source: 'unknown-source',
      type: 'mh:video-captured',
      payload: { tweetId: '999', videoUrl: 'https://video.twimg.com/x.mp4' }
    }, '*');

    // 给消息派发留出时间
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(platform.getVideoUrlFromCache('999')).toBeNull();
  });

  it('非 video.twimg.com 的地址被域名白名单拒绝', async () => {
    const platform = makePlatform();

    window.postMessage({
      source: 'mh-inject',
      type: 'mh:video-captured',
      payload: { tweetId: '777', videoUrl: 'https://evil.example.com/payload.mp4' }
    }, '*');

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(platform.getVideoUrlFromCache('777')).toBeNull();
  });

  it('缺字段的消息载荷被安全忽略', async () => {
    const platform = makePlatform();

    window.postMessage({
      source: 'mh-inject',
      type: 'mh:video-captured',
      payload: { tweetId: '888' }
    }, '*');

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(platform.getVideoUrlFromCache('888')).toBeNull();
  });
});
