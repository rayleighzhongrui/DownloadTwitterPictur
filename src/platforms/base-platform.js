import { ErrorLogger } from '../utils/error-logger.js';

export class BasePlatform {
  constructor({ name, downloader, retryManager } = {}) {
    this.name = name;
    this.downloader = downloader;
    this.retryManager = retryManager;
  }

  detectAction() {
    throw new Error('detectAction() must be implemented');
  }

  async handleAction() {
    throw new Error('handleAction() must be implemented');
  }

  validateData() {
    return true;
  }

  async handleError(error, context) {
    await ErrorLogger.log({
      platform: this.name,
      action: context?.action || 'unknown',
      url: context?.url || '',
      error: error?.message || String(error),
      retryCount: context?.retryCount || 0,
      success: false
    });
  }

  // 批量下载进度上报：单项完成（无论成败）后调用，由 background 聚合展示
  sendBatchProgress(batchKey, current, total) {
    if (!total || total <= 1) return;
    try {
      chrome.runtime.sendMessage({ action: 'downloadProgress', batchKey, current, total });
    } catch (e) {
      // 扩展上下文失效（页面卸载中）时静默忽略
    }
  }
}
