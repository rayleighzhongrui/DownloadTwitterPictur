import { ConfigManager } from './core/config.js';
import { FilenameGenerator } from './core/filename-generator.js';
import { RetryManager } from './utils/retry.js';
import { Notifier } from './utils/notifier.js';
import { ErrorLogger } from './utils/error-logger.js';
import { resolveExtension } from './utils/file-type.js';
import { t } from './utils/i18n.js';
import { fetchPixivOriginalDataUrl } from './core/pixiv-original.js';

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

// 下载元数据缓存：onChanged 只携带 downloadId，
// 需要 platform/url/filename 才能把中断事件写进错误日志。
const downloadMetaCache = new Map();

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

  let downloadUrl;
  const downloadTask = async () => {
    if (!downloadUrl) {
      downloadUrl = request.platform === 'pixiv' && new URL(request.url).hostname === 'i.pximg.net'
        ? await fetchPixivOriginalDataUrl(request.url)
        : request.url;
    }
    return new Promise((resolve, reject) => {
      chrome.downloads.download({ url: downloadUrl, filename, saveAs: false }, downloadId => {
        if (chrome.runtime.lastError) {
          const error = new Error(chrome.runtime.lastError.message);
          return reject(error);
        }
        resolve(downloadId);
      });
    });
  };

  // 多图批次不发逐张通知，由进度通知统一展示
  const isBatchItem = Number(request.pageTotal) > 1;

  try {
    const downloadId = await retryManager.retry(downloadTask, {
      name: type === 'video' ? '视频下载' : '图片下载',
      onRetry: ({ attempt }) => {
        if (attempt === 2 && notificationsEnabled) {
          Notifier.showWarning(
            t('notifRetryTitle', [], '下载重试中'),
            t('notifRetryGeneric', [], '网络波动导致失败，正在重试…')
          );
        }
      }
    });
    downloadMetaCache.set(downloadId, { platform: request.platform, url: request.url, filename });
    if (notificationsEnabled && !isBatchItem) {
      Notifier.showSuccess(
        t('notifQueuedTitle', [], '下载开始'),
        t(type === 'video' ? 'notifQueuedVideo' : 'notifQueuedImage', [], '已加入下载队列')
      );
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
      Notifier.showError(
        t('notifFailedTitle', [], '下载失败'),
        t('notifFailedMessage', [error.message], `下载失败：${error.message}`)
      );
    }
    return { success: false, error: error.message };
  }
}

// 批量进度聚合：多个批次（连续点赞多篇多图作品）共用一条进度通知。
// current 取各批次已完成的单调最大值，避免并发上报导致进度回退。
const batchProgress = new Map();

function handleDownloadProgress({ batchKey, current, total }) {
  const key = batchKey || 'default';
  const prev = batchProgress.get(key) || { current: 0, total: 0 };
  batchProgress.set(key, {
    current: Math.max(prev.current, Number(current) || 0),
    total: Math.max(prev.total, Number(total) || 0)
  });

  let done = 0;
  let sum = 0;
  for (const batch of batchProgress.values()) {
    done += batch.current;
    sum += batch.total;
  }

  if (done < sum) {
    Notifier.showProgress(done, sum);
    return;
  }

  batchProgress.clear();
  Notifier.clearProgress();
  if (sum > 0) {
    Notifier.showSuccess(
      t('notifBatchDoneTitle', [], '批量下载完成'),
      t('notifBatchDoneMessage', [String(sum)], `共 ${sum} 个文件已加入下载队列`)
    );
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
      if (configCache.notificationsEnabled) {
        handleDownloadProgress(request);
      } else {
        batchProgress.clear();
        Notifier.clearProgress();
      }
    });
  }
});

// 下载"加入队列"成功不代表落盘成功：网络断开、磁盘满等
// 会在之后触发 state=interrupted，这里补全失败链路并写入错误日志。
chrome.downloads.onChanged.addListener(delta => {
  if (!delta.state) return;

  if (delta.state.current === 'complete') {
    downloadMetaCache.delete(delta.id);
    return;
  }
  if (delta.state.current !== 'interrupted') return;

  const meta = downloadMetaCache.get(delta.id) || {};
  downloadMetaCache.delete(delta.id);
  const error = (delta.error && delta.error.current) || 'INTERRUPTED';

  chrome.downloads.search({ id: delta.id }, items => {
    const item = Array.isArray(items) ? items[0] : null;
    const filePath = (item && item.filename) || meta.filename || '';
    const file = filePath.split(/[\\/]/).pop() || '';

    ErrorLogger.log({
      platform: meta.platform || 'unknown',
      action: 'downloadInterrupted',
      url: meta.url || (item && (item.finalUrl || item.url)) || '',
      error,
      success: false
    });

    ensureHydrated().then(() => {
      if (!configCache.notificationsEnabled) return;
      Notifier.showError(
        t('notifInterruptedTitle', [], '下载已中断'),
        t('notifInterruptedMessage', [file || '-', error], `${file} ${error}`)
      );
    });
  });
});
