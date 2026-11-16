import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let onMessage;
let onDownloadChanged;
let local;
let settings;

vi.mock('../src/utils/notifier.js', () => ({
  Notifier: {
    showProgress: vi.fn(), clearProgress: vi.fn(), showSuccess: vi.fn(),
    showError: vi.fn(), showWarning: vi.fn()
  }
}));

beforeEach(() => {
  vi.resetModules();
  local = { errorLogs: [] };
  settings = { notificationsEnabled: false };
  vi.clearAllMocks();
  vi.stubGlobal('chrome', {
    storage: {
      sync: { get: vi.fn(async () => settings) },
      local: {
        get: vi.fn(async () => local),
        set: vi.fn(async data => Object.assign(local, data))
      },
      onChanged: { addListener: vi.fn() }
    },
    runtime: { onMessage: { addListener: vi.fn(listener => { onMessage = listener; }) } },
    downloads: {
      download: vi.fn((options, callback) => callback(123)),
      onChanged: { addListener: vi.fn(listener => { onDownloadChanged = listener; }) },
      search: vi.fn((query, callback) => callback([{ filename: 'test.jpg' }]))
    }
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'image/jpeg' },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
  }));
});

afterEach(() => vi.unstubAllGlobals());

async function send(request) {
  await import('../src/background.js');
  return new Promise(resolve => {
    expect(onMessage(request, {}, resolve)).toBe(true);
  });
}

const original = 'https://i.pximg.net/original.jpg';
const metadata = { platform: 'pixiv', authorName: 'artist', illustId: '111' };

describe('background real-download contract', () => {
  it('fetches a direct Pixiv original and queues its bytes with the custom filename', async () => {
    const response = await send({ action: 'downloadImage', url: original, ...metadata });
    expect(response).toEqual({ success: true, downloadId: 123 });
    expect(fetch).toHaveBeenCalledWith(original);
    expect(chrome.downloads.download).toHaveBeenCalledWith({
      url: 'data:image/jpeg;base64,AQID', filename: 'artist_111.jpg', saveAs: false
    }, expect.any(Function));
  });

  it.each([
    { platform: 'pixiv', url: 'https://pixiv.zhongrui.app/original.jpg' },
    { platform: 'twitter', url: 'https://pbs.twimg.com/media/test?format=png' }
  ])('leaves non-direct download sources unchanged: $url', async source => {
    expect((await send({ action: 'downloadImage', ...metadata, ...source })).success).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(chrome.downloads.download).toHaveBeenCalledWith(expect.objectContaining({
      url: source.url, saveAs: false
    }), expect.any(Function));
  });

  it('rejects HTTP errors instead of downloading an error page', async () => {
    fetch.mockResolvedValue({ ok: false, status: 403 });
    expect(await send({ action: 'downloadImage', url: original, ...metadata })).toEqual({
      success: false, error: 'HTTP 403'
    });
    expect(chrome.downloads.download).not.toHaveBeenCalled();
    expect(local.errorLogs[0]).toMatchObject({ platform: 'pixiv', url: original, action: 'downloadImage' });
  });

  it('rejects a 200 HTML response instead of saving it as an image', async () => {
    fetch.mockResolvedValue({ ok: true, headers: { get: () => 'text/html' } });
    expect((await send({ action: 'downloadImage', url: original, ...metadata })).success).toBe(false);
    expect(chrome.downloads.download).not.toHaveBeenCalled();
  });

  it('does not show batch notifications when notifications are disabled', async () => {
    await import('../src/background.js');
    const { Notifier } = await import('../src/utils/notifier.js');
    onMessage({ action: 'downloadProgress', batchKey: 'test', current: 1, total: 2 }, {}, vi.fn());
    await vi.waitFor(() => expect(Notifier.clearProgress).toHaveBeenCalled());
    expect(Notifier.showProgress).not.toHaveBeenCalled();
    expect(Notifier.showSuccess).not.toHaveBeenCalled();
  });

  it('updates and clears one batch notification when enabled', async () => {
    settings.notificationsEnabled = true;
    await import('../src/background.js');
    const { Notifier } = await import('../src/utils/notifier.js');
    onMessage({ action: 'downloadProgress', batchKey: 'test', current: 1, total: 2 }, {}, vi.fn());
    await vi.waitFor(() => expect(Notifier.showProgress).toHaveBeenCalledWith(1, 2));
    onMessage({ action: 'downloadProgress', batchKey: 'test', current: 2, total: 2 }, {}, vi.fn());
    await vi.waitFor(() => expect(Notifier.clearProgress).toHaveBeenCalled());
    expect(Notifier.showSuccess).toHaveBeenCalledOnce();
  });

  it('tracks the original source in interrupted-download logs, not the data URL', async () => {
    await send({ action: 'downloadImage', url: original, ...metadata });
    onDownloadChanged({ id: 123, state: { current: 'interrupted' }, error: { current: 'FILE_NO_SPACE' } });
    await vi.waitFor(() => expect(local.errorLogs[0]?.action).toBe('downloadInterrupted'));
    expect(local.errorLogs[0]).toMatchObject({ url: original, platform: 'pixiv', error: 'FILE_NO_SPACE' });
  });
});
