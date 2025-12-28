import { ConfigManager } from './core/config.js';
import { Downloader } from './core/downloader.js';
import { RetryManager } from './utils/retry.js';
import { TwitterPlatform } from './platforms/twitter/twitter-platform.js';
import { PixivPlatform } from './platforms/pixiv/pixiv-platform.js';

class ContentScript {
  constructor() {
    this.platforms = new Map();
    this.config = new ConfigManager();
    this.downloader = new Downloader();
    this.retryManager = new RetryManager();
    this.handleClick = this.handleClick.bind(this);
  }

  async init() {
    const switches = await this.config.getSwitches();
    this.updatePlatforms(switches);
    document.addEventListener('click', this.handleClick, true);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes.twitterSwitchActive || changes.pixivSwitchActive) {
        const twitterSwitchActive = changes.twitterSwitchActive
          ? changes.twitterSwitchActive.newValue
          : this.platforms.has('twitter');
        const pixivSwitchActive = changes.pixivSwitchActive
          ? changes.pixivSwitchActive.newValue
          : this.platforms.has('pixiv');
        this.updatePlatforms({ twitterSwitchActive, pixivSwitchActive });
      }
    });
  }

  updatePlatforms({ twitterSwitchActive, pixivSwitchActive }) {
    if (twitterSwitchActive) {
      if (!this.platforms.has('twitter')) {
        this.platforms.set('twitter', new TwitterPlatform({
          downloader: this.downloader,
          retryManager: this.retryManager
        }));
      }
    } else {
      this.platforms.delete('twitter');
    }

    if (pixivSwitchActive) {
      if (!this.platforms.has('pixiv')) {
        this.platforms.set('pixiv', new PixivPlatform({
          downloader: this.downloader,
          retryManager: this.retryManager
        }));
      }
    } else {
      this.platforms.delete('pixiv');
    }
  }

  async handleClick(event) {
    for (const platform of this.platforms.values()) {
      if (!platform.detectAction(event)) continue;
      try {
        await platform.handleAction(event);
      } catch (error) {
        await platform.handleError(error, { action: 'handleAction' });
      }
      break;
    }
  }
}

new ContentScript().init();
