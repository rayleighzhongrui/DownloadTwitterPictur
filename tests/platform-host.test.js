import { describe, expect, it } from 'vitest';
import { getPlatformForHost } from '../src/core/platform-host.js';

describe('getPlatformForHost', () => {
  it.each([
    ['x.com', 'twitter'], ['www.x.com', 'twitter'], ['twitter.com', 'twitter'],
    ['mobile.twitter.com', 'twitter'], ['PIXIV.NET', 'pixiv'], ['www.pixiv.net', 'pixiv'],
    ['example.com', null], ['notpixiv.net', null], ['pixiv.net.evil.test', null],
    ['x.com.evil.test', null], ['', null], [null, null]
  ])('%s maps to %s', (host, expected) => {
    expect(getPlatformForHost(host)).toBe(expected);
  });
});
