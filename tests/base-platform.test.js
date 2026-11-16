import { afterEach, describe, expect, it, vi } from 'vitest';
import { BasePlatform } from '../src/platforms/base-platform.js';
import { ErrorLogger } from '../src/utils/error-logger.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('diagnostic context', () => {
  it('includes page, version and stack without retaining URL query/hash', async () => {
    window.happyDOM.setURL('https://x.com/home?token=secret#private');
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '1.4.1' }) } });
    const log = vi.spyOn(ErrorLogger, 'log').mockResolvedValue();
    const error = new Error('test failure');
    await new BasePlatform({ name: 'twitter' }).handleError(error, { action: 'handleAction' });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'twitter', action: 'handleAction', pageUrl: 'https://x.com/home',
      extensionVersion: '1.4.1', error: 'test failure', stack: error.stack
    }));
    expect(JSON.stringify(log.mock.calls[0])).not.toContain('token=secret');
  });
});
