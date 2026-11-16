import { beforeEach, describe, expect, it } from 'vitest';
import { findPixivBookmarkButton } from '../src/platforms/pixiv/pixiv-detector.js';

function render(html) {
  document.body.innerHTML = html;
  return document.querySelector('button, [role="button"]');
}

beforeEach(() => {
  window.happyDOM.setURL('https://www.pixiv.net/discovery');
  document.body.innerHTML = '';
});

describe('Pixiv bookmark detection', () => {
  it.each([
    'data-ga4-label="bookmark_button"',
    'aria-label="收藏"',
    'title="ブックマークに追加"',
    'aria-label="Add to bookmarks"',
    'class="artwork-bookmark-button"'
  ])('accepts explicit bookmark markers: %s', attributes => {
    const button = render(`<button ${attributes}><svg><path></path></svg></button>`);
    expect(findPixivBookmarkButton(button.querySelector('path'))).toBe(button);
  });

  it('recognizes the specific unlabeled Pixiv heart glyph used on recommendation cards', () => {
    const button = render('<button><svg viewBox="0 0 32 32"><path d="M21,5.5 C24.8659932,5.5 28,8.63400675 28,12.5 C28,18.2694439 24.2975093,23.1517313 17.2206059,27.1100183"></path></svg></button>');
    expect(findPixivBookmarkButton(button)).toBe(button);
  });

  it('supports the dedicated bookmark_button wrapper on detail recommendation cards', () => {
    const button = render('<div data-ga4-label="bookmark_button"><button><svg></svg></button></div>');
    expect(findPixivBookmarkButton(button)).toBe(button);
  });

  it('supports role=button and text-node click targets', () => {
    const button = render('<div role="button" aria-label="收藏">收藏</div>');
    expect(findPixivBookmarkButton(button.firstChild)).toBe(button);
  });

  it.each(['', 'aria-label="分享"', 'aria-label="通知"', 'aria-label="关注"'])(
    'does not treat an arbitrary SVG button as a bookmark: %s', attributes => {
      const button = render(`<button ${attributes}><svg></svg></button>`);
      expect(findPixivBookmarkButton(button)).toBeNull();
    }
  );

  it('does not borrow a bookmark hint from an unrelated ancestor', () => {
    const button = render('<section class="bookmark-list"><button aria-label="分享"><svg></svg></button></section>');
    expect(findPixivBookmarkButton(button)).toBeNull();
  });

  it('ignores disabled buttons', () => {
    const button = render('<button disabled data-ga4-label="bookmark_button"><svg></svg></button>');
    expect(findPixivBookmarkButton(button)).toBeNull();
  });

  it.each(['https://x.com/home', 'https://twitter.com/home', 'https://pixiv.net.evil.example/'])(
    'never recognizes Pixiv controls outside Pixiv: %s', url => {
      window.happyDOM.setURL(url);
      const button = render('<button aria-label="Bookmark"><svg></svg></button>');
      expect(findPixivBookmarkButton(button)).toBeNull();
    }
  );

  it('ignores missing targets', () => {
    expect(findPixivBookmarkButton(null)).toBeNull();
  });
});
