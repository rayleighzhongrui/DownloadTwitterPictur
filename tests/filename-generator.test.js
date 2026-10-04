import { describe, it, expect } from 'vitest';
import { FilenameGenerator } from '../src/core/filename-generator.js';

const fixedClock = () => new Date('2026-10-03T12:00:00Z');
const g = new FilenameGenerator({ clock: fixedClock });

describe('FilenameGenerator', () => {
  describe('基本拼接', () => {
    it('拼接 Twitter authorName + tweetId', () => {
      const out = g.generate({
        platform: 'twitter',
        formats: ['authorName', 'tweetId'],
        metadata: { authorName: 'Ada', tweetId: '1234567890' },
        type: 'image',
        extension: 'jpg'
      });
      expect(out).toBe('Ada_1234567890.jpg');
    });

    it('拼接 Pixiv authorName + illustId', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['authorName', 'illustId'],
        metadata: { authorName: 'artist', illustId: '99999' },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('artist_99999.png');
    });

    it('downloadDate 输出为 YYYYMMDD', () => {
      const out = g.generate({
        platform: 'twitter',
        formats: ['downloadDate'],
        metadata: { tweetId: '1' },
        type: 'image',
        extension: 'jpg'
      });
      expect(out).toBe('20261003.jpg');
    });
  });

  describe('sanitize 非法字符', () => {
    it.each([
      ['/'],
      ['\\'],
      [':'],
      ['*'],
      ['?'],
      ['"'],
      ['<'],
      ['>'],
      ['|']
    ])('替换 %s 为下划线', (ch) => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['authorName'],
        metadata: { authorName: `a${ch}b`, illustId: '1' },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('a_b.png');
    });

    it('中日韩文字保留', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['authorName'],
        metadata: { authorName: '山田太郎', illustId: '1' },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('山田太郎.png');
    });

    it('控制字符被去除', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['authorName'],
        metadata: { authorName: 'a\x00\x01b', illustId: '1' },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('a_b.png');
    });
  });

  describe('多图序号', () => {
    it('单图不加后缀', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['illustId'],
        metadata: { illustId: '1' },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('1.png');
    });

    it('多图按 2 位填充', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['illustId'],
        metadata: { illustId: '99999', pageIndex: 1, pageTotal: 10 },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('99999_p01.png');
    });

    it('12 页作品第 10 页', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['illustId'],
        metadata: { illustId: '1', pageIndex: 10, pageTotal: 12 },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('1_p10.png');
    });

    it('没有 pageIndex 不强制加后缀', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['illustId'],
        metadata: { illustId: '1', pageTotal: 5 },
        type: 'image',
        extension: 'png'
      });
      expect(out).toBe('1.png');
    });
  });

  describe('fallback', () => {
    it('formats 为空且 metadata 缺失时用 platform + 日期', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: [],
        metadata: {},
        type: 'image',
        extension: 'jpg'
      });
      expect(out).toBe('pixiv_20261003.jpg');
    });

    it('所有 parts 都是空字符串时也走 fallback', () => {
      const out = g.generate({
        platform: 'twitter',
        formats: ['authorName', 'tweetId'],
        metadata: {},
        type: 'image',
        extension: 'jpg'
      });
      expect(out).toBe('twitter_20261003.jpg');
    });
  });

  describe('视频', () => {
    it('带分辨率后缀', () => {
      const out = g.generate({
        platform: 'twitter',
        formats: ['authorName', 'tweetId'],
        metadata: { authorName: 'foo', tweetId: '111' },
        type: 'video',
        extension: 'mp4',
        resolution: '1920x1080'
      });
      expect(out).toBe('foo_111_1920x1080.mp4');
    });
  });

  describe('长度保护', () => {
    it('超长 metadata 被截断（保留扩展名）', () => {
      const long = 'a'.repeat(300);
      const out = g.generate({
        platform: 'pixiv',
        formats: ['authorName'],
        metadata: { authorName: long, illustId: '1' },
        type: 'image',
        extension: 'png'
      });
      expect(out.length).toBeLessThanOrEqual(200);
      expect(out.endsWith('.png')).toBe(true);
    });
  });

  describe('基于 URL 智能识别扩展名', () => {
    it('当未显式指定 extension 时从 url 推断 png', () => {
      const out = g.generate({
        platform: 'pixiv',
        formats: ['illustId'],
        metadata: { illustId: '150410354' },
        type: 'image',
        url: 'https://i.pximg.net/img-original/img/2026/10/03/12/00/00/150410354_p0.png'
      });
      expect(out).toBe('150410354.png');
    });

    it('当未显式指定 extension 时从 Twitter format 参数推断 png', () => {
      const out = g.generate({
        platform: 'twitter',
        formats: ['authorName', 'tweetId'],
        metadata: { authorName: 'artist', tweetId: '987654' },
        type: 'image',
        url: 'https://pbs.twimg.com/media/Gf4_aXXX?format=png&name=orig'
      });
      expect(out).toBe('artist_987654.png');
    });
  });
});
