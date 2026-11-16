/**
 * ProxyManager - 内置代理（产品决策：不提供用户配置入口，降低使用门槛）
 * 使用固定的 Cloudflare 反代域名转发 i.pximg.net 原图请求（绕过防盗链与 CORS）。
 * 反代不可用时由 downloadWithFallback 回退到 i.pximg.net 直连。
 */
export class ProxyManager {
  constructor() {
    // 内置代理域名，用户无需任何配置
    this.proxyDomain = 'pixiv.zhongrui.app';
  }

  async load() {
    // 保持接口兼容性：代理为内置固定值，无需从存储加载
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
