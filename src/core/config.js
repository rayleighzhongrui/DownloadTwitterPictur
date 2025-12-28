import { Storage } from '../utils/storage.js';

const DEFAULTS = {
  twitterSwitchActive: true,
  pixivSwitchActive: true,
  notificationsEnabled: true,
  twitterFilenameFormat: ['account', 'tweetId'],
  pixivFilenameFormat: ['authorName', 'illustId'],
  pixivProxies: [],
  activeProxyId: null,
  autoSwitchProxy: true,
  roundRobinProxy: false,
  proxyTestUrl: 'https://www.pixiv.net/artworks/119870733'
};

export class ConfigManager {
  async getSwitches() {
    const result = await Storage.getSync(['twitterSwitchActive', 'pixivSwitchActive']);
    return {
      twitterSwitchActive: typeof result.twitterSwitchActive === 'undefined'
        ? DEFAULTS.twitterSwitchActive
        : result.twitterSwitchActive,
      pixivSwitchActive: typeof result.pixivSwitchActive === 'undefined'
        ? DEFAULTS.pixivSwitchActive
        : result.pixivSwitchActive
    };
  }

  async getFilenameFormats() {
    const result = await Storage.getSync(['twitterFilenameFormat', 'pixivFilenameFormat']);
    return {
      twitterFilenameFormat: result.twitterFilenameFormat || DEFAULTS.twitterFilenameFormat,
      pixivFilenameFormat: result.pixivFilenameFormat || DEFAULTS.pixivFilenameFormat
    };
  }

  async getNotificationSetting() {
    const result = await Storage.getSync('notificationsEnabled');
    return typeof result.notificationsEnabled === 'undefined'
      ? DEFAULTS.notificationsEnabled
      : result.notificationsEnabled;
  }

  async getProxySettings() {
    const result = await Storage.getSync([
      'pixivProxies',
      'activeProxyId',
      'autoSwitchProxy',
      'roundRobinProxy',
      'proxyTestUrl'
    ]);

    return {
      pixivProxies: result.pixivProxies || DEFAULTS.pixivProxies,
      activeProxyId: result.activeProxyId || DEFAULTS.activeProxyId,
      autoSwitchProxy: typeof result.autoSwitchProxy === 'undefined'
        ? DEFAULTS.autoSwitchProxy
        : result.autoSwitchProxy,
      roundRobinProxy: typeof result.roundRobinProxy === 'undefined'
        ? DEFAULTS.roundRobinProxy
        : result.roundRobinProxy,
      proxyTestUrl: result.proxyTestUrl || DEFAULTS.proxyTestUrl
    };
  }

  async setSettings(settings) {
    await Storage.setSync(settings);
  }
}
