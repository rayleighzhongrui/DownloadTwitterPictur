import { ConfigManager } from './core/config.js';
import { FilenameGenerator } from './core/filename-generator.js';
import { RetryManager } from './utils/retry.js';
import { Notifier } from './utils/notifier.js';
import { ErrorLogger } from './utils/error-logger.js';
import { Storage } from './utils/storage.js';
import { resolveExtension } from './utils/file-type.js';

const configManager = new ConfigManager();
const filenameGenerator = new FilenameGenerator();
const retryManager = new RetryManager();

// 内存缓存：避免每次下载都打两次 storage（format + notifications）。
// 缓存项由 storage.onChanged 自动失效。
const configCache = {
  formats: null,
  notificationsEnabled: null,
  hydrated: false
};

async function ensureHydrated() {
  if (configCache.hydrated) return;
  const [formats, notificationsEnabled] = await Promise.all([
    configManager.getFilenameFormats(),
    configManager.getNotificationSetting()
  ]);
  configCache.formats = formats;
  configCache.notificationsEnabled = notificationsEnabled;
  configCache.hydrated = true;
}

function invalidate(changes) {
  if ('twitterFilenameFormat' in changes || 'pixivFilenameFormat' in changes) {
    configCache.formats = null;
    configCache.hydrated = false;
  }
  if ('notificationsEnabled' in changes) {
    configCache.notificationsEnabled = null;
    configCache.hydrated = false;
  }
}

async function downloadWithRetry(request, type) {
  await ensureHydrated();
  const formats = configCache.formats;
  const notificationsEnabled = configCache.notificationsEnabled;
  const formatList = request.platform === 'pixiv'
    ? formats.pixivFilenameFormat
    : formats.twitterFilenameFormat;

  const extension = request.extension || resolveExtension(request.url, type);
  const filename = filenameGenerator.generate({
    platform: request.platform,
    formats: formatList,
    metadata: request,
    type,
    extension,
    url: request.url,
    resolution: request.resolution
  });

  const downloadTask = () => new Promise((resolve, reject) => {
    chrome.downloads.download({ url: request.url, filename }, downloadId => {
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message);
        return reject(error);
      }
      resolve(downloadId);
    });
  });

  try {
    const downloadId = await retryManager.retry(downloadTask, {
      name: type === 'video' ? '视频下载' : '图片下载',
      onRetry: ({ attempt }) => {
        if (attempt === 2 && notificationsEnabled) {
          Notifier.showWarning('下载重试中', '网络波动导致失败，正在重试...');
        }
      }
    });
    if (notificationsEnabled) {
      Notifier.showSuccess('下载开始', `${type === 'video' ? '视频' : '图片'}已加入下载队列`);
    }
    return { success: true, downloadId };
  } catch (error) {
    await ErrorLogger.log({
      platform: request.platform,
      action: type === 'video' ? 'downloadVideo' : 'downloadImage',
      url: request.url,
      error: error.message,
      retryCount: retryManager.maxRetries,
      success: false
    });
    if (notificationsEnabled) {
      Notifier.showError('下载失败', error);
    }
    return { success: false, error: error.message };
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') invalidate(changes);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImage' && request.url) {
    downloadWithRetry(request, 'image').then(sendResponse);
    return true;
  }

  if (request.action === 'downloadVideo' && request.url) {
    downloadWithRetry(request, 'video').then(sendResponse);
    return true;
  }

  if (request.action === 'notify') {
    ensureHydrated().then(() => {
      if (!configCache.notificationsEnabled) return;
      if (request.level === 'warning') {
        Notifier.showWarning(request.title, request.message);
      } else if (request.level === 'error') {
        Notifier.showError(request.title, request.message);
      } else {
        Notifier.showSuccess(request.title, request.message);
      }
    });
  }

  if (request.action === 'downloadProgress') {
    ensureHydrated().then(() => {
      if (!configCache.notificationsEnabled) return;
      Notifier.showProgress(request.current, request.total);
    });
  }
});

// 首次安装 / 升级时把旧用户从硬编码代理迁移到配置存储。
// 保留这段以兼容旧 release，但当前默认 ProxyManager.getProxyDomain 已经是占位符。
chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'update') return;
  const { pixivProxies = [] } = await Storage.getSync('pixivProxies');
  if (pixivProxies.length > 0) return;

  const legacyProxy = 'pixiv.zhongrui.app';
  await Storage.setSync({
    pixivProxies: [{
      id: 'migrated-proxy',
      name: '历史代理（已迁移）',
      domain: legacyProxy,
      enabled: true,
      priority: 1
    }],
    activeProxyId: 'migrated-proxy'
  });

  await ensureHydrated();
  if (configCache.notificationsEnabled) {
    Notifier.showSuccess('代理配置已升级', 'Pixiv 代理设置已迁移到新配置面板。');
  }
});
