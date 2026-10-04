import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Downloader } from '../src/core/downloader.js';

describe('Downloader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isDuplicate 防抖去重', () => {
    it('在防抖窗口内相同的 URL 仅允许第一次通过', () => {
      const downloader = new Downloader({ dedupWindowMs: 3000 });
      const testUrl = 'https://i.pximg.net/img-original/img/.../123_p0.png';

      expect(downloader.isDuplicate(testUrl)).toBe(false);
      expect(downloader.isDuplicate(testUrl)).toBe(true);
      expect(downloader.isDuplicate(testUrl)).toBe(true);
    });

    it('不同的 URL 不会互相影响', () => {
      const downloader = new Downloader({ dedupWindowMs: 3000 });
      const url1 = 'https://pbs.twimg.com/media/img1?format=png';
      const url2 = 'https://pbs.twimg.com/media/img2?format=png';

      expect(downloader.isDuplicate(url1)).toBe(false);
      expect(downloader.isDuplicate(url2)).toBe(false);
    });

    it('超出防抖窗口后允许再次下载', async () => {
      const downloader = new Downloader({ dedupWindowMs: 50 });
      const testUrl = 'https://pbs.twimg.com/media/img1?format=png';

      expect(downloader.isDuplicate(testUrl)).toBe(false);
      expect(downloader.isDuplicate(testUrl)).toBe(true);

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(downloader.isDuplicate(testUrl)).toBe(false);
    });

    it('重复 URL 时 downloadImage 直接返回 deduplicated 并不发送 chrome 消息', async () => {
      const downloader = new Downloader({ dedupWindowMs: 3000 });
      const sendSpy = vi.spyOn(downloader, 'sendMessage').mockResolvedValue({ success: true, downloadId: 101 });

      const testUrl = 'https://i.pximg.net/123.jpg';

      const first = await downloader.downloadImage({ url: testUrl, metadata: {} });
      expect(first.success).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);

      const second = await downloader.downloadImage({ url: testUrl, metadata: {} });
      expect(second.success).toBe(true);
      expect(second.deduplicated).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1); // 没有第二次发送
    });
  });
});
