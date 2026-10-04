import { describe, it, expect } from 'vitest';
import { extractTweetImages, extractTweetVideoComponents, findTweetContainer } from '../src/platforms/twitter/twitter-detector.js';

describe('twitter-detector', () => {
  describe('extractTweetImages', () => {
    it('正确提取推文图片并根据 pathname 基础路径去重', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div>
          <!-- 同一张图带有不同参数 -->
          <img src="https://pbs.twimg.com/media/Gf4_aABC?format=jpg&name=small">
          <img src="https://pbs.twimg.com/media/Gf4_aABC?format=jpg&name=large">
          <!-- 另一张图 -->
          <img src="https://pbs.twimg.com/media/Gf4_aXYZ?format=png&name=small">
          <!-- 非推文内容图（如头像） -->
          <img src="https://pbs.twimg.com/profile_images/123/avatar.jpg">
        </div>
      `;

      const images = extractTweetImages(container);
      expect(images).toHaveLength(2);
      expect(images[0].src).toContain('Gf4_aABC');
      expect(images[1].src).toContain('Gf4_aXYZ');
    });
  });

  describe('findTweetContainer', () => {
    it('支持匹配 article[data-testid="tweet"]', () => {
      const article = document.createElement('article');
      article.setAttribute('data-testid', 'tweet');
      const likeBtn = document.createElement('button');
      likeBtn.setAttribute('data-testid', 'like');
      article.appendChild(likeBtn);
      document.body.appendChild(article);

      const found = findTweetContainer(likeBtn);
      expect(found).toBe(article);

      document.body.removeChild(article);
    });

    it('回退匹配 cellInnerDiv', () => {
      const cell = document.createElement('div');
      cell.setAttribute('data-testid', 'cellInnerDiv');
      const likeBtn = document.createElement('button');
      likeBtn.setAttribute('data-testid', 'like');
      cell.appendChild(likeBtn);
      document.body.appendChild(cell);

      const found = findTweetContainer(likeBtn);
      expect(found).toBe(cell);

      document.body.removeChild(cell);
    });
  });

  describe('extractTweetVideoComponents', () => {
    it('同时识别 videoComponent 容器与裸 video 元素（GIF 形态）', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div>
          <!-- 普通视频：videoComponent 容器包裹 -->
          <div data-testid="videoComponent">
            <video poster="https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/abc.jpg"></video>
          </div>
          <!-- GIF：直接是裸 video 元素，poster 为 tweet_video_thumb -->
          <video poster="https://pbs.twimg.com/tweet_video_thumb/Gf4abc123/img/xyz.jpg" loop muted></video>
        </div>
      `;

      const components = extractTweetVideoComponents(container);
      const videos = components.map(c => (c.tagName === 'VIDEO' ? c : c.querySelector('video')));

      expect(components).toHaveLength(2);
      expect(videos[0].getAttribute('poster')).toContain('ext_tw_video_thumb');
      expect(videos[1].tagName).toBe('VIDEO');
      expect(videos[1].getAttribute('poster')).toContain('tweet_video_thumb');
    });

    it('videoComponent 内的 video 不会被重复计入', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div data-testid="videoComponent">
          <video poster="https://pbs.twimg.com/amplify_video_thumb/1/img/a.jpg"></video>
        </div>
      `;

      const components = extractTweetVideoComponents(container);
      expect(components).toHaveLength(1);
      expect(components[0].getAttribute('data-testid')).toBe('videoComponent');
    });
  });
});
