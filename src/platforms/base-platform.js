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
}
