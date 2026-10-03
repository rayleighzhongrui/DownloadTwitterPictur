import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildOriginalImageUrl, fetchIllustMeta, fetchIllustPages } from '../src/platforms/pixiv/pixiv-api.js';

describe('buildOriginalImageUrl (legacy / DOM fallback)', () => {
  it('匹配标准路径 (YYYY/MM/DD/HH/MM/SS/ID)', () => {
    const src = 'https://i.pximg.net/img/2026/10/03/00/00/00/1234567890_p0_master1200.jpg';
    const out = buildOriginalImageUrl(src, 'proxy.example.com', '1234567890');
    expect(out).toEqual({
      illustId: '1234567890',
      url: 'https://proxy.example.com/img-original/img/2026/10/03/00/00/00/1234567890_p0.png'
    });
  });

  it('匹配简化路径 (YYYY/MM/DD/ID)', () => {
    const src = 'https://i.pximg.net/img/2026/10/03/1234567890_p0_master1200.jpg';
    const out = buildOriginalImageUrl(src, 'proxy.example.com', '1234567890');
    expect(out.illustId).toBe('1234567890');
    expect(out.url).toBe('https://proxy.example.com/img-original/img/2026/10/03/00/00/00/1234567890_p0.png');
  });

  it('illustId 参数优先于 URL 中匹配到的 ID', () => {
    const src = 'https://i.pximg.net/img/2026/10/03/00/00/00/999_p0.jpg';
    const out = buildOriginalImageUrl(src, 'proxy.example.com', '888');
    expect(out.illustId).toBe('888');
    expect(out.url).toContain('/888_p0.png');
  });

  it('不匹配的 URL 返回 null', () => {
    expect(buildOriginalImageUrl('https://example.com/foo.jpg', 'proxy.example.com', '1')).toBeNull();
  });

  it('illustId 为 unknown_id 时回退到 URL 中的 ID', () => {
    const src = 'https://i.pximg.net/img/2026/10/03/00/00/00/1234567890_p0.jpg';
    const out = buildOriginalImageUrl(src, 'proxy.example.com', 'unknown_id');
    expect(out.illustId).toBe('1234567890');
  });
});

describe('fetchIllustMeta', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('解包 { error, message, body } 后返回元数据', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: false,
        message: '',
        body: {
          illustId: 12345,
          illustTitle: 'a piece',
          userId: 67890,
          userName: 'artist',
          pageCount: 3,
          urls: { original: 'https://i.pximg.net/img/.../12345_p0.png' },
          tags: { tags: [{ tag: 'tag1' }, { tag: 'tag2' }] }
        }
      })
    });
    const meta = await fetchIllustMeta('12345');
    expect(meta).toEqual({
      illustId: 12345,
      illustTitle: 'a piece',
      userId: 67890,
      userName: 'artist',
      pageCount: 3,
      originalUrl: 'https://i.pximg.net/img/.../12345_p0.png',
      tags: ['tag1', 'tag2']
    });
  });

  it('服务端返回 error 时抛出 message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: true, message: '作品不存在' })
    });
    await expect(fetchIllustMeta('999')).rejects.toThrow('作品不存在');
  });

  it('HTTP 错误时抛出带状态码', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });
    await expect(fetchIllustMeta('999')).rejects.toThrow('HTTP 404');
  });

  it('body 缺失 illustId 时抛出', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: false, message: '', body: {} })
    });
    await expect(fetchIllustMeta('999')).rejects.toThrow(/缺少 body/);
  });

  it('/ajax 接口始终直连 www.pixiv.net（不走代理）', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: false, message: '', body: { illustId: 1, userId: 1, userName: 'a' } })
    });
    await fetchIllustMeta('1');
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toMatch(/^https:\/\/www\.pixiv\.net\/ajax\/illust\/1$/);
  });
});

describe('fetchIllustPages', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('解包 body 数组返回每页原图 URL', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: false,
        message: '',
        body: [
          {
            width: 1000, height: 2000,
            urls: { original: 'https://i.pximg.net/img/.../1_p0.png' }
          },
          {
            width: 1000, height: 2000,
            urls: { original: 'https://i.pximg.net/img/.../1_p1.png' }
          }
        ]
      })
    });
    const pages = await fetchIllustPages('1');
    expect(pages).toHaveLength(2);
    expect(pages[0].urls.original).toMatch(/_p0\.png$/);
    expect(pages[1].urls.original).toMatch(/_p1\.png$/);
  });

  it('body 非数组时抛出', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: false, message: '', body: { foo: 1 } })
    });
    await expect(fetchIllustPages('1')).rejects.toThrow(/结构异常/);
  });
});
