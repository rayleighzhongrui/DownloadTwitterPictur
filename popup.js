import { Storage } from './src/utils/storage.js';

const DEFAULT_TWITTER_FORMATS = ['account', 'tweetId'];
const DEFAULT_PIXIV_FORMATS = ['authorName', 'illustId'];

// 简化版 state - 移除代理相关字段
const state = {};

// 根据浏览器语言映射 locale（与网站使用的相同）
function getLocale() {
  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang.startsWith('ja')) {
    return 'ja';
  } else if (browserLang === 'zh-TW' || browserLang.startsWith('zh-Hant')) {
    return 'zh-TW';
  } else if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  } else if (browserLang.startsWith('de')) {
    return 'de';
  } else if (browserLang.startsWith('ko')) {
    return 'ko';
  } else if (browserLang.startsWith('ru')) {
    return 'ru';
  } else if (browserLang.startsWith('cs')) {
    return 'cs';
  }
  return 'en';
}

// 当前已加载的翻译，供动态生成的元素使用
let currentTranslations = {};

// 取指定 key 的翻译文案
function t(key) {
  const entry = currentTranslations[key];
  return entry ? entry.message : '';
}

// 国际化函数：替换所有带有data-i18n属性的元素
async function applyI18n() {
  const elements = document.querySelectorAll('[data-i18n]');

  // 加载对应语言的翻译文件，失败时回退到英文
  try {
    const response = await fetch(`_locales/${getLocale()}/messages.json`);
    currentTranslations = await response.json();
  } catch (error) {
    const response = await fetch('_locales/en/messages.json');
    currentTranslations = await response.json();
  }

  // 应用翻译
  elements.forEach(element => {
    const message = element.getAttribute('data-i18n');
    if (currentTranslations[message]) {
      element.textContent = currentTranslations[message].message;
    }
  });

  // 更新页面标题
  const titleElement = document.querySelector('title[data-i18n]');
  if (titleElement) {
    const message = titleElement.getAttribute('data-i18n');
    if (currentTranslations[message]) {
      document.title = currentTranslations[message].message;
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
  'zh-CN': {
    'account': '示例用户_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': '示例作者_',
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
  },
  'zh-TW': {
    'account': '範例使用者_',
    'tweetId': '88669977_',
    'tweetTime': '20230810_',
    'authorName': '範例作者_',
    'authorId': '12345_',
    'illustId': '88669977_',
    'downloadDate': '20230811_'
  }
};

function updateExample(containerId, exampleId) {
  const formats = getSelectedFormats(containerId);
  const texts = EXAMPLE_TEXTS[getLocale()] || EXAMPLE_TEXTS['en'];
  let exampleText = '';

  formats.forEach(format => {
    if (texts[format]) {
      exampleText += texts[format];
    }
  });

  if (exampleId === 'twitterVideoExample') {
    exampleText = exampleText.slice(0, -1) + '_1920x1080.mp4';
  } else {
    exampleText = exampleText.slice(0, -1) + '.jpg';
  }

  document.getElementById(exampleId).textContent = exampleText;
}

function toggleSelection(containerId, exampleId, videoExampleId = null) {
  const container = document.getElementById(containerId);
  container.addEventListener('click', event => {
    // 文字被 span 包裹（用于 i18n），需要向上找到 format-option
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

function getSelectedFormats(containerId) {
  const container = document.getElementById(containerId);
  const selectedOptions = container.querySelectorAll('.format-option.selected');
  return Array.from(selectedOptions).map(option => option.getAttribute('data-value'));
}

function showSuccessMessage() {
  const successMessage = document.getElementById('successMessage');
  successMessage.style.display = 'flex';
  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 2000);
}

function initSelection(containerId, storedFormats) {
  const container = document.getElementById(containerId);
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
      document.getElementById(targetId).classList.add('active');
    });
  });
}

// 日志相关函数
async function loadLogs() {
  const platform = document.getElementById('logPlatform').value;
  const { errorLogs = [] } = await Storage.getLocal('errorLogs');

  const filteredLogs = platform === 'all'
    ? errorLogs
    : errorLogs.filter(log => log.platform === platform);

  const logList = document.getElementById('logList');
  logList.innerHTML = '';

  if (filteredLogs.length === 0) {
    logList.innerHTML = `<div class="empty-state">${t('noLogs') || '暂无错误日志'}</div>`;
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
document.getElementById('saveButton').addEventListener('click', async () => {
  const twitterFormats = getSelectedFormats('twitterFormat');
  const pixivFormats = getSelectedFormats('pixivFormat');
  const twitterSwitchState = document.getElementById('twitterSwitch').checked;
  const pixivSwitchState = document.getElementById('pixivSwitch').checked;
  const notificationsEnabled = document.getElementById('notificationSwitch').checked;

  await Storage.setSync({
    twitterFilenameFormat: twitterFormats,
    pixivFilenameFormat: pixivFormats,
    twitterSwitchActive: twitterSwitchState,
    pixivSwitchActive: pixivSwitchState,
    notificationsEnabled
  });
  showSuccessMessage();
});

// 日志事件监听
document.getElementById('logPlatform').addEventListener('change', loadLogs);
document.getElementById('clearLogs').addEventListener('click', async () => {
  await Storage.setLocal({ errorLogs: [] });
  loadLogs();
});
document.getElementById('exportLogs').addEventListener('click', exportLogs);

// 初始化
async function init() {
  // 先应用国际化，再渲染示例和日志
  await applyI18n();

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

  // 绑定格式选项点击（重构时丢失，此处恢复）
  toggleSelection('twitterFormat', 'twitterExample', 'twitterVideoExample');
  toggleSelection('pixivFormat', 'pixivExample');

  document.getElementById('twitterSwitch').checked = twitterSwitch;
  document.getElementById('pixivSwitch').checked = pixivSwitch;
  document.getElementById('notificationSwitch').checked = notificationsEnabled;

  bindTabs();
  await loadLogs();
}

// 启动
init();
