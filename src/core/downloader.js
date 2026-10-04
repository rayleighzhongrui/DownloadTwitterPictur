export class Downloader {
  constructor({ dedupWindowMs = 5000 } = {}) {
    this.dedupWindowMs = dedupWindowMs;
    this.recentDownloads = new Map();
  }

  isDuplicate(url) {
    if (!url || this.dedupWindowMs <= 0) return false;
    const now = Date.now();
    const last = this.recentDownloads.get(url);
    if (last && (now - last) < this.dedupWindowMs) {
      return true;
    }
    this.recentDownloads.set(url, now);

    // 定期清理过期项，防止内存长期占用
    if (this.recentDownloads.size > 200) {
      for (const [key, timestamp] of this.recentDownloads.entries()) {
        if (now - timestamp >= this.dedupWindowMs) {
          this.recentDownloads.delete(key);
        }
      }
    }
    return false;
  }

  async downloadImage({ url, metadata }) {
    if (this.isDuplicate(url)) {
      return { success: true, deduplicated: true };
    }
    return this.sendMessage('downloadImage', { url, ...metadata });
  }

  async downloadVideo({ url, metadata }) {
    if (this.isDuplicate(url)) {
      return { success: true, deduplicated: true };
    }
    return this.sendMessage('downloadVideo', { url, ...metadata });
  }

  sendMessage(action, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...payload }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success) {
          resolve(response);
          return;
        }
        reject(new Error(response?.error?.message || response?.error || '无响应'));
      });
    });
  }
}
