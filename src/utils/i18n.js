// chrome.i18n 的安全封装：测试环境或 key 缺失时回退到调用方给定的兜底文案
export function t(key, substitutions = [], fallback = '') {
  try {
    const msg = chrome.i18n.getMessage(key, substitutions);
    if (msg) return msg;
  } catch (e) {
    // chrome.i18n 不可用（单测等非扩展环境）
  }
  return fallback;
}
