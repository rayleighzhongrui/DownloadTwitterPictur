// 与 manifest 中的站点范围一致；不能用 includes() 匹配，避免伪装域名。
export function getPlatformForHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  const matches = domain => host === domain || host.endsWith(`.${domain}`);
  if (matches('twitter.com') || matches('x.com')) return 'twitter';
  if (matches('pixiv.net')) return 'pixiv';
  return null;
}
