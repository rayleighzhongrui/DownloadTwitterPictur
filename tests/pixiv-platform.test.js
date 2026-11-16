import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PixivPlatform } from '../src/platforms/pixiv/pixiv-platform.js';
import { fetchIllustMeta, fetchIllustPages } from '../src/platforms/pixiv/pixiv-api.js';
import { pixivCache } from '../src/utils/pixiv-dom-cache.js';

vi.mock('../src/platforms/pixiv/pixiv-api.js', () => ({
  fetchIllustMeta: vi.fn(),
  fetchIllustPages: vi.fn()
}));

const bookmark = '<button data-ga4-label="bookmark_button"><svg></svg></button>';
function card(id, attributes = '') {
  return `<li ${attributes}><a href="/artworks/${id}"><img></a>${bookmark}</li>`;
}

let platform;
let download;
let handleError;

beforeEach(() => {
  vi.clearAllMocks();
  window.happyDOM.setURL('https://www.pixiv.net/discovery');
  document.body.innerHTML = '';
  pixivCache.clear();
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn() } });
  fetchIllustMeta.mockImplementation(async id => ({ illustId: id, userId: '42', userName: 'artist' }));
  fetchIllustPages.mockResolvedValue([{ urls: { original: 'https://i.pximg.net/test_p0.jpg' } }]);
  platform = new PixivPlatform({ downloader: {}, retryManager: null });
  download = vi.spyOn(platform, 'downloadWithFallback').mockResolvedValue();
  handleError = vi.spyOn(platform, 'handleError').mockResolvedValue();
});

afterEach(() => vi.unstubAllGlobals());

describe('Pixiv action / artwork association', () => {
  it('downloads the clicked card, not the first card on the page', async () => {
    document.body.innerHTML = `<ul>${card('111')}${card('222')}</ul>`;
    expect(await platform.handleAction({ target: document.querySelectorAll('button')[1] })).toBe(true);
    expect(fetchIllustMeta).toHaveBeenCalledWith('222');
    expect(download).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ illustId: '222', pageIndex: 1 }));
  });

  it.each(['', '<a href="/artworks/999">unrelated artwork</a>'])(
    'missing artwork association fails safely without an invalid selector or global guessing: %s', async unrelated => {
      document.body.innerHTML = `${unrelated}<section>${bookmark}</section>`;
      expect(await platform.handleAction({ target: document.querySelector('button') })).toBe(false);
      expect(fetchIllustMeta).not.toHaveBeenCalled();
      expect(download).not.toHaveBeenCalled();
      expect(handleError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ action: 'detectIllustId' }));
    }
  );

  it('accepts an artwork entity ID even when the card has no link', async () => {
    document.body.innerHTML = `<div data-ga4-entity-id="illust/333">${bookmark}</div>`;
    expect(await platform.handleAction({ target: document.querySelector('button') })).toBe(true);
    expect(fetchIllustMeta).toHaveBeenCalledWith('333');
  });

  it.each(['/artworks/444', '/en/artworks/444'])(
    'uses the detail URL for the main bookmark: %s', async path => {
      window.happyDOM.setURL(`https://www.pixiv.net${path}`);
      document.body.innerHTML = `<main><button class="gtm-main-bookmark">收藏</button></main><aside>${card('555')}</aside>`;
      expect(await platform.handleAction({ target: document.querySelector('main button') })).toBe(true);
      expect(fetchIllustMeta).toHaveBeenCalledWith('444');
    }
  );

  it('prefers a recommendation card over the current detail URL', async () => {
    window.happyDOM.setURL('https://www.pixiv.net/artworks/444');
    document.body.innerHTML = `<main>${bookmark}</main><aside>${card('555')}</aside>`;
    expect(await platform.handleAction({ target: document.querySelector('aside button') })).toBe(true);
    expect(fetchIllustMeta).toHaveBeenCalledWith('555');
  });

  it('handles CSS-background recommendation thumbnails inside the main artwork entity', async () => {
    window.happyDOM.setURL('https://www.pixiv.net/artworks/444');
    document.body.innerHTML = `<div data-ga4-entity-id="illust/444"><button class="gtm-main-bookmark">收藏</button><div class="sc-card"><a href="/artworks/555"><figure></figure></a><div data-ga4-label="bookmark_button"><button id="recommendation"><svg></svg></button></div></div></div>`;
    expect(await platform.handleAction({ target: document.querySelector('#recommendation') })).toBe(true);
    expect(fetchIllustMeta).toHaveBeenCalledWith('555');
  });

  it('does not use the main detail URL for an unassociated secondary bookmark', async () => {
    window.happyDOM.setURL('https://www.pixiv.net/artworks/444');
    document.body.innerHTML = `<main><button class="gtm-main-bookmark">收藏</button></main><aside>${bookmark}</aside>`;
    expect(await platform.handleAction({ target: document.querySelector('aside button') })).toBe(false);
    expect(fetchIllustMeta).not.toHaveBeenCalled();
  });

  it('re-reads links when a cached card DOM is recycled by the SPA', async () => {
    document.body.innerHTML = `<ul>${card('111')}</ul>`;
    const container = document.querySelector('li');
    const button = container.querySelector('button');
    pixivCache.setContainer(button, container);
    container.querySelector('a').href = '/artworks/222';
    expect(await platform.handleAction({ target: button })).toBe(true);
    expect(fetchIllustMeta).toHaveBeenCalledWith('222');
  });

  it('does not cross from an orphan bookmark into another card in a shared feed', async () => {
    document.body.innerHTML = `<div><section>${bookmark}</section><ul>${card('999')}</ul></div>`;
    expect(await platform.handleAction({ target: document.querySelector('section button') })).toBe(false);
    expect(fetchIllustMeta).not.toHaveBeenCalled();
  });

  it('invalidates a cached container when its button moves to another card', async () => {
    document.body.innerHTML = `<ul>${card('111')}${card('222')}</ul>`;
    const [first, second] = document.querySelectorAll('li');
    const button = first.querySelector('button');
    pixivCache.setContainer(button, first);
    second.querySelector('button').remove();
    second.append(button);
    expect(await platform.handleAction({ target: button })).toBe(true);
    expect(fetchIllustMeta).toHaveBeenCalledWith('222');
  });

  it('does not guess between multiple artwork IDs in one container', async () => {
    document.body.innerHTML = `<li><a href="/artworks/111"><img></a><a href="/artworks/222"><img></a>${bookmark}</li>`;
    expect(await platform.handleAction({ target: document.querySelector('button') })).toBe(false);
    expect(fetchIllustMeta).not.toHaveBeenCalled();
  });

  it('does not download Pixiv content from a Twitter page', async () => {
    window.happyDOM.setURL('https://x.com/home');
    document.body.innerHTML = bookmark;
    expect(await platform.handleAction({ target: document.querySelector('button') })).toBe(false);
    expect(fetchIllustMeta).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  it('keeps /pages failure fallback for a single original image', async () => {
    document.body.innerHTML = card('111');
    fetchIllustMeta.mockResolvedValue({ illustId: '111', originalUrl: 'https://i.pximg.net/fallback.jpg' });
    fetchIllustPages.mockRejectedValue(new Error('pages unavailable'));
    expect(await platform.handleAction({ target: document.querySelector('button') })).toBe(true);
    expect(download).toHaveBeenCalledWith('https://i.pximg.net/fallback.jpg', expect.any(Object));
  });

  it('continues a multi-page batch after one page fails and reports progress', async () => {
    document.body.innerHTML = card('111');
    fetchIllustPages.mockResolvedValue([1, 2, 3].map(i => ({ urls: { original: `https://i.pximg.net/${i}.jpg` } })));
    download.mockRejectedValueOnce(new Error('one image unavailable'));
    expect(await platform.handleAction({ target: document.querySelector('button') })).toBe(true);
    expect(download).toHaveBeenCalledTimes(3);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ action: 'downloadImage' }));
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      action: 'downloadProgress', batchKey: 'pixiv:111', current: 3, total: 3
    });
  });

  it('tries the proxy first and the direct original second', async () => {
    download.mockRestore();
    const image = vi.spyOn(platform, 'downloadImage').mockRejectedValueOnce(new Error('proxy unavailable')).mockResolvedValue();
    await platform.downloadWithFallback('https://i.pximg.net/original.jpg', { illustId: '111' });
    expect(image.mock.calls.map(call => call[0])).toEqual([
      'https://pixiv.zhongrui.app/original.jpg', 'https://i.pximg.net/original.jpg'
    ]);
  });

  it('hands a direct original to Chrome downloads without a CORS-blocked HEAD request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch (CORS)')));
    platform.downloader.downloadImage = vi.fn().mockResolvedValue({ success: true });
    await platform.downloadImage('https://i.pximg.net/original.jpg', { illustId: '111' });
    expect(fetch).not.toHaveBeenCalled();
    expect(platform.downloader.downloadImage).toHaveBeenCalledWith({
      url: 'https://i.pximg.net/original.jpg', metadata: { illustId: '111', platform: 'pixiv' }
    });
  });

  it('logs an API failure without attempting a download', async () => {
    document.body.innerHTML = card('111');
    fetchIllustMeta.mockRejectedValue(new Error('HTTP 403'));
    expect(await platform.handleAction({ target: document.querySelector('button') })).toBe(false);
    expect(download).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ action: 'fetchIllustMeta' }));
  });
});
