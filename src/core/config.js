import { Storage } from '../utils/storage.js';

const DEFAULTS = {
  twitterSwitchActive: true,
  pixivSwitchActive: true,
  notificationsEnabled: true,
  twitterFilenameFormat: ['account', 'tweetId'],
  pixivFilenameFormat: ['authorName', 'illustId']
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

  async setSettings(settings) {
    await Storage.setSync(settings);
  }
}
