import { Storage } from './utils/storage.js';

const DEFAULT_TWITTER_FORMATS = ['account', 'tweetId'];
const DEFAULT_PIXIV_FORMATS = ['authorName', 'illustId'];

// 国际化文案读取封装
function t(key) {
  if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
    const msg = chrome.i18n.getMessage(key);
    if (msg) return msg;
  }
  return '';
}

// 获取当前语言标识，用于示例文件名文案
function getCurrentLocale() {
  const lang = (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.())
    || (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage))
    || 'en';

  if (lang.startsWith('ja')) return 'ja';
  if (lang === 'zh-TW' || lang === 'zh_TW' || lang.startsWith('zh-Hant')) return 'zh_TW';
  if (lang.startsWith('zh')) return 'zh_CN';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('cs')) return 'cs';
  return 'en';
}

// 国际化函数：替换所有带有 data-i18n 属性的元素
function applyI18n() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const msg = t(key);
    if (msg) {
      element.textContent = msg;
    }
  });

  const titleElement = document.querySelector('title[data-i18n]');
  if (titleElement) {
    const key = titleElement.getAttribute('data-i18n');
    const msg = t(key);
    if (msg) {
      document.title = msg;
    }
  }
}

// 各语言的示例文件名片段
const EXAMPLE_TEXTS = {
  'en': {
    'account': 'exampleUser_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': 'exampleAuthor_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  },
  'ja': {
    'account': 'サンプルユーザー_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': 'サンプル作者_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  },
  'zh_CN': {
    'account': '示例用户_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': '示例作者_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  },
  'zh_TW': {
    'account': '範例使用者_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': '範例作者_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  },
  'de': {
    'account': 'BeispielBenutzer_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': 'BeispielAutor_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  },
  'ko': {
    'account': '예시사용자_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': '예시작가_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  },
  'ru': {
    'account': 'ПримерПользователя_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': 'ПримерАвтора_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  },
  'cs': {
    'account': 'PříkladUživatel_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': 'PříkladAutor_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  }
};

function getSelectedFormats(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const selectedOptions = container.querySelectorAll('.format-option.selected');
  return Array.from(selectedOptions).map(option => option.getAttribute('data-value'));
}

function updateExample(containerId, exampleId) {
  const formats = getSelectedFormats(containerId);
  const locale = getCurrentLocale();
  const texts = EXAMPLE_TEXTS[locale] || EXAMPLE_TEXTS['en'];
  let exampleText = '';

  formats.forEach(format => {
    if (texts[format]) {
      exampleText += texts[format];
    }
  });

  const targetEl = document.getElementById(exampleId);
  if (!targetEl) return;

  if (exampleId === 'twitterVideoExample') {
    exampleText = exampleText ? (exampleText.slice(0, -1) + '_1920x1080.mp4') : '1920x1080.mp4';
  } else {
    exampleText = exampleText ? (exampleText.slice(0, -1) + '.jpg') : 'example.jpg';
  }

  targetEl.textContent = exampleText;
}

function toggleSelection(containerId, exampleId, videoExampleId = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener('click', event => {
    const option = event.target.closest('.format-option');
    if (option) {
      option.classList.toggle('selected');
      updateExample(containerId, exampleId);
      if (videoExampleId) {
        updateExample(containerId, videoExampleId);
      }
    }
  });
}

function showSuccessMessage() {
  const successMessage = document.getElementById('successMessage');
  if (!successMessage) return;
  successMessage.style.display = 'flex';
  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 2000);
}

function initSelection(containerId, storedFormats) {
  const container = document.getElementById(containerId);
  if (!container) return;
  storedFormats.forEach(format => {
    const option = container.querySelector(`[data-value="${format}"]`);
    if (option) {
      option.classList.add('selected');
    }
  });

  if (containerId === 'twitterFormat') {
    updateExample(containerId, 'twitterExample');
    updateExample(containerId, 'twitterVideoExample');
  } else {
    const exampleId = containerId === 'pixivFormat' ? 'pixivExample' : 'twitterExample';
    updateExample(containerId, exampleId);
  }
}

function bindTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(btn => btn.classList.remove('active'));
      contents.forEach(content => content.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `${tab.dataset.tab}-tab`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 日志相关函数
async function loadLogs() {
  const platformEl = document.getElementById('logPlatform');
  if (!platformEl) return;
  const platform = platformEl.value;
  const { errorLogs = [] } = await Storage.getLocal('errorLogs');

  const filteredLogs = platform === 'all'
    ? errorLogs
    : errorLogs.filter(log => log.platform === platform);

  const logList = document.getElementById('logList');
  if (!logList) return;
  logList.innerHTML = '';

  if (filteredLogs.length === 0) {
    const emptyMsg = t('noLogs') || '暂无错误日志';
    logList.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
    return;
  }

  filteredLogs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `
      <div class="log-header">
        <span class="log-platform">${log.platform}</span>
        <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
      </div>
      <div class="log-action">${log.action}</div>
      <div class="log-error">${log.error}</div>
      ${log.url ? `<div class="log-url">${log.url.substring(0, 50)}...</div>` : ''}
    `;
    logList.appendChild(item);
  });
}

async function exportLogs() {
  const { errorLogs = [] } = await Storage.getLocal('errorLogs');
  if (errorLogs.length === 0) {
    alert(t('noLogsToExport') || '暂无日志可导出');
    return;
  }

  const content = errorLogs.map(log => JSON.stringify(log, null, 2)).join('\n');
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 保存设置
const saveButton = document.getElementById('saveButton');
if (saveButton) {
  saveButton.addEventListener('click', async () => {
    const twitterFormats = getSelectedFormats('twitterFormat');
    const pixivFormats = getSelectedFormats('pixivFormat');
    const twitterSwitchState = document.getElementById('twitterSwitch')?.checked ?? true;
    const pixivSwitchState = document.getElementById('pixivSwitch')?.checked ?? true;
    const notificationsEnabled = document.getElementById('notificationSwitch')?.checked ?? true;

    await Storage.setSync({
      twitterFilenameFormat: twitterFormats,
      pixivFilenameFormat: pixivFormats,
      twitterSwitchActive: twitterSwitchState,
      pixivSwitchActive: pixivSwitchState,
      notificationsEnabled
    });
    showSuccessMessage();
  });
}

// 日志事件监听
const logPlatform = document.getElementById('logPlatform');
if (logPlatform) logPlatform.addEventListener('change', loadLogs);

const clearLogs = document.getElementById('clearLogs');
if (clearLogs) {
  clearLogs.addEventListener('click', async () => {
    await Storage.setLocal({ errorLogs: [] });
    loadLogs();
  });
}

const exportLogsBtn = document.getElementById('exportLogs');
if (exportLogsBtn) exportLogsBtn.addEventListener('click', exportLogs);

// 初始化
async function init() {
  applyI18n();

  const result = await Storage.getSync([
    'twitterFilenameFormat',
    'pixivFilenameFormat',
    'twitterSwitchActive',
    'pixivSwitchActive',
    'notificationsEnabled'
  ]);

  const twitterFormats = result.twitterFilenameFormat || DEFAULT_TWITTER_FORMATS;
  const pixivFormats = result.pixivFilenameFormat || DEFAULT_PIXIV_FORMATS;
  const twitterSwitch = typeof result.twitterSwitchActive === 'undefined' ? true : result.twitterSwitchActive;
  const pixivSwitch = typeof result.pixivSwitchActive === 'undefined' ? true : result.pixivSwitchActive;
  const notificationsEnabled = typeof result.notificationsEnabled === 'undefined' ? true : result.notificationsEnabled;

  initSelection('twitterFormat', twitterFormats);
  initSelection('pixivFormat', pixivFormats);

  toggleSelection('twitterFormat', 'twitterExample', 'twitterVideoExample');
  toggleSelection('pixivFormat', 'pixivExample');

  const twSwitch = document.getElementById('twitterSwitch');
  if (twSwitch) twSwitch.checked = twitterSwitch;
  const pxSwitch = document.getElementById('pixivSwitch');
  if (pxSwitch) pxSwitch.checked = pixivSwitch;
  const notifSwitch = document.getElementById('notificationSwitch');
  if (notifSwitch) notifSwitch.checked = notificationsEnabled;

  bindTabs();
  await loadLogs();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
