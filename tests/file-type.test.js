import { describe, it, expect } from 'vitest';
import { resolveExtension } from '../src/utils/file-type.js';

describe('resolveExtension', () => {
  describe('Pixiv 图片 URL 解析', () => {
    it('正确解析 Pixiv 原图 png 后缀', () => {
      const url = 'https://i.pximg.net/img-original/img/2026/10/03/12/34/56/150410354_p0.png';
      expect(resolveExtension(url)).toBe('png');
    });

    it('正确解析 Pixiv 原图 jpg 后缀', () => {
      const url = 'https://i.pximg.net/img-original/img/2026/10/03/12/34/56/150410354_p0.jpg';
      expect(resolveExtension(url)).toBe('jpg');
    });

    it('正确解析 Pixiv gif 动图', () => {
      const url = 'https://i.pximg.net/img-original/img/2026/10/03/12/34/56/150410354_p0.gif';
      expect(resolveExtension(url)).toBe('gif');
    });

    it('支持经由反向代理的 Pixiv 图片 URL', () => {
      const url = 'https://pixiv.zhongrui.app/img-original/img/2026/10/03/12/34/56/150410354_p0.png';
      expect(resolveExtension(url)).toBe('png');
    });
  });

  describe('Twitter 资源 URL 解析', () => {
    it('解析 format=png 查询参数', () => {
      const url = 'https://pbs.twimg.com/media/Gf4_aABCDEF1234?format=png&name=orig';
      expect(resolveExtension(url)).toBe('png');
    });

    it('解析 format=jpg 查询参数', () => {
      const url = 'https://pbs.twimg.com/media/Gf4_aABCDEF1234?format=jpg&name=orig';
      expect(resolveExtension(url)).toBe('jpg');
    });

    it('将 format=jpeg 归一化为 jpg', () => {
      const url = 'https://pbs.twimg.com/media/Gf4_aABCDEF1234?format=jpeg&name=large';
      expect(resolveExtension(url)).toBe('jpg');
    });

    it('解析 format=webp', () => {
      const url = 'https://pbs.twimg.com/media/Gf4_aABCDEF1234?format=webp&name=orig';
      expect(resolveExtension(url)).toBe('webp');
    });

    it('支持旧式 Twitter URL 后缀带冒号修饰符 (:orig)', () => {
      const url = 'https://pbs.twimg.com/media/Gf4_aABCDEF1234.jpg:orig';
      expect(resolveExtension(url)).toBe('jpg');
    });

    it('支持旧式 Twitter URL png 后缀带修饰符 (:large)', () => {
      const url = 'https://pbs.twimg.com/media/Gf4_aABCDEF1234.png:large';
      expect(resolveExtension(url)).toBe('png');
    });

    it('支持 Twitter 视频 URL 提取 mp4', () => {
      const url = 'https://video.twimg.com/ext_tw_video/1234567890/vid/1920x1080/sample.mp4?tag=12';
      expect(resolveExtension(url, 'video')).toBe('mp4');
    });
  });

  describe('异常输入与兜底回退', () => {
    it('无参数或空字符串时图片默认回退为 jpg', () => {
      expect(resolveExtension('')).toBe('jpg');
      expect(resolveExtension(null)).toBe('jpg');
      expect(resolveExtension(undefined)).toBe('jpg');
    });

    it('空参数且类型为 video 时默认回退为 mp4', () => {
      expect(resolveExtension('', 'video')).toBe('mp4');
      expect(resolveExtension(null, 'video')).toBe('mp4');
    });

    it('无已知格式扩展名的未知 URL 优雅回退', () => {
      expect(resolveExtension('https://example.com/api/image_stream')).toBe('jpg');
      expect(resolveExtension('https://example.com/api/video_stream', 'video')).toBe('mp4');
    });
  });
});
