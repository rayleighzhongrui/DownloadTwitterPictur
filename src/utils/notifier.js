export class Notifier {
  static showSuccess(title, message, options = {}) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message,
      requireInteraction: false,
      ...options
    });
  }

  static showError(title, error, actionUrl = null) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message: `下载失败：${error?.message || error}`,
      requireInteraction: true,
      buttons: actionUrl ? [{ title: '查看详情' }] : [],
      priority: 2
    });
  }

  static showWarning(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message,
      requireInteraction: false,
      priority: 1
    });
  }

  static showProgress(current, total) {
    chrome.notifications.create({
      type: 'progress',
      iconUrl: 'images/icon.png',
      title: '批量下载中',
      message: `已完成 ${current}/${total}`,
      progress: Math.round((current / total) * 100)
    });
  }
}
