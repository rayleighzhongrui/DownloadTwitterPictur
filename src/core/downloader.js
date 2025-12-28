export class Downloader {
  async downloadImage({ url, metadata }) {
    return this.sendMessage('downloadImage', { url, ...metadata });
  }

  async downloadVideo({ url, metadata }) {
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
