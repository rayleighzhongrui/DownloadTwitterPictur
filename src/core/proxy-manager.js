/**
 * ProxyManager - 简化版（硬编码代理）
 * 直接使用固定的代理域名，无需配置
 */
export class ProxyManager {
  constructor() {
    // 硬编码代理域名 - 请替换为你自己的 Cloudflare 反代域名
    // 格式示例: pixiv.example.com
    this.proxyDomain = 'YOUR_PROXY_DOMAIN_HERE';
  }

  async load() {
    // 不再从存储加载配置
    // 直接返回成功，保持接口兼容性
    return Promise.resolve();
  }

  /**
   * 获取代理域名
   * @returns {string} 代理域名
   */
  getProxyDomain() {
    return this.proxyDomain;
  }
}
