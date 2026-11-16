import { t } from './i18n.js';

const PROGRESS_ID = 'batch-progress';

export class Notifier {
  static showSuccess(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message
    });
  }

  static showWarning(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message,
      priority: 1
    });
  }

  static showError(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message,
      requireInteraction: true,
      priority: 2
    });
  }

  // 进度通知使用固定 ID 复用同一条通知，避免批量下载时刷屏。
  // update 的目标不存在时（首次或通知被用户关闭）回退到 create。
  static showProgress(current, total) {
    const options = {
      type: 'progress',
      iconUrl: 'images/icon.png',
      title: t('notifBatchTitle', [], '批量下载中'),
      message: t('notifBatchProgress', [String(current), String(total)], `已完成 ${current}/${total}`),
      progress: total > 0 ? Math.round((current / total) * 100) : 0
    };
    chrome.notifications.update(PROGRESS_ID, options, wasUpdated => {
      if (chrome.runtime.lastError || !wasUpdated) {
        chrome.notifications.create(PROGRESS_ID, options);
      }
    });
  }

  static clearProgress() {
    chrome.notifications.clear(PROGRESS_ID);
  }
}
