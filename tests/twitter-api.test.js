import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchVideoUrlFromTwitterAPI } from '../src/platforms/twitter/twitter-api.js';

describe('fetchVideoUrlFromTwitterAPI', () => {
  beforeEach(() => {
    // 注入 csrf token 供 getCsrfToken() 读取
    Object.defineProperty(document, 'cookie', {
      writable: true,
      configurable: true,
      value: 'ct0=fake_csrf_token; other=foo'
    });
    global.fetch = vi.fn();
  });

  it('TweetResultByRestId 返回最高码率 mp4', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          tweetResult: {
            result: {
              legacy: {
                id_str: '1234',
                extended_entities: {
                  media: [{
                    type: 'video',
                    video_info: {
                      variants: [
                        { content_type: 'video/mp4', bitrate: 320000, url: 'https://video.twimg.com/low.mp4' },
                        { content_type: 'video/mp4', bitrate: 2000000, url: 'https://video.twimg.com/high.mp4' },
                        { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/playlist.m3u8' }
                      ]
                    }
                  }]
                }
              }
            }
          }
        }
      })
    });

    const url = await fetchVideoUrlFromTwitterAPI('1234');
    expect(url).toBe('https://video.twimg.com/high.mp4');
  });

  it('TweetResultByRestId 失败时回退到 TweetDetail', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          threaded_conversation_with_injections_v2: {
            instructions: [{
              type: 'TimelineAddEntries',
              entries: [{
                entryId: 'tweet-1234',
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        legacy: {
                          id_str: '1234',
                          extended_entities: {
                            media: [{
                              type: 'animated_gif',
                              video_info: {
                                variants: [
                                  { content_type: 'video/mp4', bitrate: 500000, url: 'https://video.twimg.com/gif.mp4' }
                                ]
                              }
                            }]
                          }
                        }
                      }
                    }
                  }
                }
              }]
            }]
          }
        }
      })
    });

    const url = await fetchVideoUrlFromTwitterAPI('1234');
    expect(url).toBe('https://video.twimg.com/gif.mp4');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('全部 API 失败时返回 null', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    const url = await fetchVideoUrlFromTwitterAPI('1234');
    expect(url).toBeNull();
  });

  it('响应里没有视频时返回 null', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { tweetResult: { result: { legacy: { id_str: '1234', extended_entities: { media: [] } } } } }
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          threaded_conversation_with_injections_v2: {
            instructions: [{ type: 'TimelineAddEntries', entries: [] }]
          }
        }
      })
    });

    const url = await fetchVideoUrlFromTwitterAPI('1234');
    expect(url).toBeNull();
  });

  it('没 csrf token 时返回 null（不抛错）', async () => {
    Object.defineProperty(document, 'cookie', { writable: true, configurable: true, value: '' });
    const url = await fetchVideoUrlFromTwitterAPI('1234');
    expect(url).toBeNull();
  });
});
