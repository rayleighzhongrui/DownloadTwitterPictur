import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platforms = vi.hoisted(() => ({ twitter: [], pixiv: [] }));
vi.mock('../src/platforms/twitter/twitter-platform.js', () => ({
  TwitterPlatform: class {
    constructor() {
      this.detectAction = vi.fn(() => true);
      this.handleAction = vi.fn().mockResolvedValue(true);
      this.handleError = vi.fn().mockResolvedValue();
      platforms.twitter.push(this);
    }
  }
}));
vi.mock('../src/platforms/pixiv/pixiv-platform.js', () => ({
  PixivPlatform: class {
    constructor() {
      this.detectAction = vi.fn(() => true);
      this.handleAction = vi.fn().mockResolvedValue(true);
      this.handleError = vi.fn().mockResolvedValue();
      platforms.pixiv.push(this);
    }
  }
}));

let clickHandler;
let settingsChanged;
let switches;

beforeEach(() => {
  vi.resetModules();
  platforms.twitter.length = 0;
  platforms.pixiv.length = 0;
  switches = { twitterSwitchActive: true, pixivSwitchActive: true };
  clickHandler = null;
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener) => {
    if (type === 'click') clickHandler = listener;
  });
  vi.stubGlobal('chrome', {
    storage: {
      sync: { get: vi.fn(async () => switches) },
      onChanged: { addListener: vi.fn(listener => { settingsChanged = listener; }) }
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function start(url) {
  window.happyDOM.setURL(url);
  await import('../src/content.js');
  await vi.waitFor(() => expect(clickHandler).toBeTypeOf('function'));
}

describe('content script host isolation', () => {
  it.each(['x.com', 'twitter.com', 'mobile.twitter.com'])(
    'registers only Twitter on %s even with both switches enabled', async host => {
      await start(`https://${host}/home`);
      expect(platforms.twitter).toHaveLength(1);
      expect(platforms.pixiv).toHaveLength(0);
      await clickHandler({ target: document.body });
      expect(platforms.twitter[0].handleAction).toHaveBeenCalledOnce();
    }
  );

  it('registers only Pixiv on Pixiv', async () => {
    await start('https://www.pixiv.net/discovery');
    expect(platforms.twitter).toHaveLength(0);
    expect(platforms.pixiv).toHaveLength(1);
    await clickHandler({ target: document.body });
    expect(platforms.pixiv[0].handleAction).toHaveBeenCalledOnce();
  });

  it.each(['example.com', 'notpixiv.net', 'pixiv.net.evil.example', 'x.com.evil.example'])(
    'does not register a platform on %s', async host => {
      await start(`https://${host}/`);
      expect(platforms.twitter).toHaveLength(0);
      expect(platforms.pixiv).toHaveLength(0);
    }
  );

  it('does not turn Twitter-off into a fallback to Pixiv', async () => {
    switches.twitterSwitchActive = false;
    await start('https://x.com/home');
    expect(platforms.twitter).toHaveLength(0);
    expect(platforms.pixiv).toHaveLength(0);
    await clickHandler({ target: document.body });
  });

  it('keeps host isolation after changing settings', async () => {
    await start('https://x.com/home');
    settingsChanged({ twitterSwitchActive: { newValue: false } }, 'sync');
    await clickHandler({ target: document.body });
    expect(platforms.twitter[0].handleAction).not.toHaveBeenCalled();
    settingsChanged({ pixivSwitchActive: { newValue: false } }, 'sync');
    settingsChanged({ pixivSwitchActive: { newValue: true } }, 'sync');
    expect(platforms.pixiv).toHaveLength(0);
    settingsChanged({ twitterSwitchActive: { newValue: true } }, 'sync');
    await clickHandler({ target: document.body });
    expect(platforms.twitter).toHaveLength(2);
    expect(platforms.twitter[1].handleAction).toHaveBeenCalledOnce();
  });
});
