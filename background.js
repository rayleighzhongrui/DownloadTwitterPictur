import { ConfigManager } from './src/core/config.js';
import { FilenameGenerator } from './src/core/filename-generator.js';
import { RetryManager } from './src/utils/retry.js';
import { Notifier } from './src/utils/notifier.js';
import { ErrorLogger } from './src/utils/error-logger.js';

const configManager = new ConfigManager();
const filenameGenerator = new FilenameGenerator();
const retryManager = new RetryManager();

async function downloadWithRetry(request, type) {
  const formats = await configManager.getFilenameFormats();
  const notificationsEnabled = await configManager.getNotificationSetting();
  const formatList = request.platform === 'pixiv'
    ? formats.pixivFilenameFormat
    : formats.twitterFilenameFormat;

  const filename = filenameGenerator.generate({
    platform: request.platform,
    formats: formatList,
    metadata: request,
    type,
    extension: type === 'video' ? 'mp4' : 'jpg',
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
    configManager.getNotificationSetting().then(enabled => {
      if (!enabled) return;
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
    configManager.getNotificationSetting().then(enabled => {
      if (!enabled) return;
      Notifier.showProgress(request.current, request.total);
    });
  }
});

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'update') return;
  const { pixivProxies = [] } = await chrome.storage.sync.get('pixivProxies');
  if (pixivProxies.length > 0) return;

  const legacyProxy = 'pixiv.zhongrui.app';
  await chrome.storage.sync.set({
    pixivProxies: [{
      id: 'migrated-proxy',
      name: '历史代理（已迁移）',
      domain: legacyProxy,
      enabled: true,
      priority: 1
    }],
    activeProxyId: 'migrated-proxy'
  });

  const notificationsEnabled = await configManager.getNotificationSetting();
  if (notificationsEnabled) {
    Notifier.showSuccess('代理配置已升级', 'Pixiv 代理设置已迁移到新配置面板。');
  }
});
