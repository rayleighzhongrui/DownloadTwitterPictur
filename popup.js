import { Storage } from './src/utils/storage.js';

const DEFAULT_TWITTER_FORMATS = ['account', 'tweetId'];
const DEFAULT_PIXIV_FORMATS = ['authorName', 'illustId'];

// 简化版 state - 移除代理相关字段
const state = {};

function updateExample(containerId, exampleId) {
  const formats = getSelectedFormats(containerId);
  let exampleText = '';

  formats.forEach(format => {
    switch (format) {
      case 'account':
        exampleText += 'rayleighzhong_';
        break;
      case 'tweetId':
        exampleText += '88669977_';
        break;
      case 'tweetTime':
        exampleText += '20230810_';
        break;
      case 'authorName':
        exampleText += '萩森じあ_';
        break;
      case 'authorId':
        exampleText += '12345_';
        break;
      case 'illustId':
        exampleText += '88669977_';
        break;
      case 'downloadDate':
        exampleText += '20230811_';
        break;
      default:
        break;
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
    const target = event.target;
    if (target.classList.contains('format-option')) {
      target.classList.toggle('selected');
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
    logList.innerHTML = '<div class="empty-state">暂无错误日志</div>';
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
    alert('暂无日志可导出');
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

  document.getElementById('twitterSwitch').checked = twitterSwitch;
  document.getElementById('pixivSwitch').checked = pixivSwitch;
  document.getElementById('notificationSwitch').checked = notificationsEnabled;

  bindTabs();
  await loadLogs();
}

// 启动
init();
