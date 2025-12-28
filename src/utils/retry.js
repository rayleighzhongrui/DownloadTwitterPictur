export class RetryManager {
  constructor({ maxRetries = 5, baseDelay = 1000, isRetryable } = {}) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.isRetryable = isRetryable || this.defaultRetryable;
  }

  async retry(fn, { name = '任务', onRetry } = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error)) {
          throw error;
        }

        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        if (typeof onRetry === 'function') {
          onRetry({ attempt, delay, error, name });
        }
        await this.sleep(delay);
      }
    }

    throw new Error(`${name}: 失败 ${this.maxRetries} 次后放弃。最后错误: ${lastError?.message || '未知错误'}`);
  }

  defaultRetryable(error) {
    const retryableErrors = [
      'Network timeout',
      'Connection reset',
      '5xx',
      'ETIMEDOUT',
      'ECONNRESET',
      'Failed to fetch'
    ];
    const message = error?.message || '';
    const status = error?.status || error?.response?.status;

    return retryableErrors.some(msg => message.includes(msg)) || (status && status >= 500);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
