export const Storage = {
  async getSync(keys) {
    return chrome.storage.sync.get(keys);
  },
  async setSync(items) {
    return chrome.storage.sync.set(items);
  },
  async getLocal(keys) {
    return chrome.storage.local.get(keys);
  },
  async setLocal(items) {
    return chrome.storage.local.set(items);
  }
};
