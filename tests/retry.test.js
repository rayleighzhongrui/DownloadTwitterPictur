import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryManager } from '../src/utils/retry.js';

describe('RetryManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('成功时直接返回，不重试', async () => {
    const fn = vi.fn(async () => 'ok');
    const m = new RetryManager({ maxRetries: 3, baseDelay: 10 });
    const p = m.retry(fn, { name: 'task' });
    await vi.runAllTimersAsync();
    expect(await p).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('网络错误重试到 maxRetries 后抛出', async () => {
    const fn = vi.fn(async () => {
      const e = new Error('ETIMEDOUT');
      throw e;
    });
    const m = new RetryManager({ maxRetries: 3, baseDelay: 10 });
    const p = m.retry(fn, { name: 'task' });
    p.catch(() => {}); // 避免 unhandled rejection
    await vi.runAllTimersAsync();
    await expect(p).rejects.toThrow(/失败 3 次后放弃/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('4xx 错误不重试', async () => {
    const fn = vi.fn(async () => {
      const e = new Error('HTTP 404');
      e.status = 404;
      throw e;
    });
    const m = new RetryManager({ maxRetries: 5, baseDelay: 10 });
    const p = m.retry(fn, { name: 'task' });
    await expect(p).rejects.toThrow('HTTP 404');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('5xx 错误重试', async () => {
    const fn = vi.fn(async () => {
      const e = new Error('HTTP 503');
      e.status = 503;
      throw e;
    });
    const m = new RetryManager({ maxRetries: 2, baseDelay: 10 });
    const p = m.retry(fn, { name: 'task' });
    p.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(p).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('指数退避：第 N 次延迟 = baseDelay * 2^N', async () => {
    const delays = [];
    const fn = vi.fn(async () => {
      const e = new Error('ETIMEDOUT');
      throw e;
    });
    const m = new RetryManager({ maxRetries: 3, baseDelay: 100 });
    const p = m.retry(fn, {
      name: 'task',
      onRetry: ({ delay }) => delays.push(delay)
    });
    p.catch(() => {});
    await vi.runAllTimersAsync();
    // 第 0 次失败 → 延迟 100；第 1 次失败 → 延迟 200；第 2 次失败 → 延迟 400
    expect(delays).toEqual([100, 200, 400]);
  });

  it('onRetry 每次重试都被调用', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn(async () => { throw Object.assign(new Error('ETIMEDOUT'), {}); });
    const m = new RetryManager({ maxRetries: 3, baseDelay: 10 });
    const p = m.retry(fn, { name: 'task', onRetry });
    p.catch(() => {});
    await vi.runAllTimersAsync();
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it('自定义 isRetryable：true 时继续重试', async () => {
    const fn = vi.fn(async () => { throw new Error('weird'); });
    const m = new RetryManager({
      maxRetries: 2,
      baseDelay: 10,
      isRetryable: () => true
    });
    const p = m.retry(fn, { name: 'task' });
    p.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(p).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('自定义 isRetryable：false 时立即抛错', async () => {
    const fn = vi.fn(async () => { throw new Error('whatever'); });
    const m = new RetryManager({
      maxRetries: 5,
      baseDelay: 10,
      isRetryable: () => false
    });
    const p = m.retry(fn, { name: 'task' });
    await expect(p).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('重试成功后返回结果', async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call += 1;
      if (call < 3) throw new Error('ETIMEDOUT');
      return 'success';
    });
    const m = new RetryManager({ maxRetries: 5, baseDelay: 10 });
    const p = m.retry(fn, { name: 'task' });
    await vi.runAllTimersAsync();
    expect(await p).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
