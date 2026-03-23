// popup.js

// 国际化函数：替换所有带有data-i18n属性的元素
async function applyI18n() {
    const elements = document.querySelectorAll('[data-i18n]');

    // 获取浏览器的语言设置（与网站使用的相同）
    const browserLang = navigator.language || navigator.userLanguage;

    // 映射浏览器语言到locale
    let locale = 'en';
    if (browserLang.startsWith('ja')) {
        locale = 'ja';
    } else if (browserLang === 'zh-TW' || browserLang === 'zh-Hant' || browserLang === 'zh-Hant-TW') {
        locale = 'zh-TW';
    } else if (browserLang.startsWith('zh')) {
        locale = 'zh-CN';
    } else if (browserLang.startsWith('de')) {
        locale = 'de';
    } else if (browserLang.startsWith('ko')) {
        locale = 'ko';
    } else if (browserLang.startsWith('ru')) {
        locale = 'ru';
    } else if (browserLang.startsWith('cs')) {
        locale = 'cs';
    }

    // 加载对应语言的翻译文件
    let translations;
    try {
        const response = await fetch(`_locales/${locale}/messages.json`);
        translations = await response.json();
    } catch (error) {
        const response = await fetch(`_locales/en/messages.json`);
        translations = await response.json();
    }

    // 应用翻译
    elements.forEach(element => {
        const message = element.getAttribute('data-i18n');
        if (translations[message]) {
            element.textContent = translations[message].message;
        }
    });

    // 更新页面标题
    const titleElement = document.querySelector('title[data-i18n]');
    if (titleElement) {
        const message = titleElement.getAttribute('data-i18n');
        if (translations[message]) {
            document.title = translations[message].message;
        }
    }
}

// 页面加载时应用国际化
document.addEventListener('DOMContentLoaded', applyI18n);

// 更新示例文件名
async function updateExample(containerId, exampleId) {
    const formats = getSelectedFormats(containerId);
    let exampleText = '';

    // 获取当前语言
    const browserLang = navigator.language || navigator.userLanguage;
    let locale = 'en';
    if (browserLang.startsWith('ja')) {
        locale = 'ja';
    } else if (browserLang === 'zh-TW' || browserLang === 'zh-Hant' || browserLang === 'zh-Hant-TW') {
        locale = 'zh-TW';
    } else if (browserLang.startsWith('zh')) {
        locale = 'zh-CN';
    } else if (browserLang.startsWith('de')) {
        locale = 'de';
    } else if (browserLang.startsWith('ko')) {
        locale = 'ko';
    } else if (browserLang.startsWith('ru')) {
        locale = 'ru';
    } else if (browserLang.startsWith('cs')) {
        locale = 'cs';
    }

    // 根据语言设置示例文字
    const exampleTexts = {
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

    const texts = exampleTexts[locale] || exampleTexts['en'];

    formats.forEach(format => {
        if (texts[format]) {
            exampleText += texts[format];
        }
    });

    // 根据示例类型选择不同的扩展名
    if (exampleId === 'twitterVideoExample') {
        exampleText = exampleText.slice(0, -1) + '_1920x1080.mp4'; // 视频示例
    } else {
        exampleText = exampleText.slice(0, -1) + '.jpg'; // 图片示例
    }

    document.getElementById(exampleId).textContent = exampleText;
}

// 处理按钮点击选择并更新示例
function toggleSelection(containerId, exampleId, videoExampleId = null) {
    const container = document.getElementById(containerId);
    container.addEventListener('click', async function(event) {
        const target = event.target;
        if (target.classList.contains('format-option')) {
            target.classList.toggle('selected');
            await updateExample(containerId, exampleId);
            // 如果提供了视频示例ID，也更新视频示例
            if (videoExampleId) {
                await updateExample(containerId, videoExampleId);
            }
        }
    });
}

// 获取已选择的格式
function getSelectedFormats(containerId) {
    const container = document.getElementById(containerId);
    const selectedOptions = container.querySelectorAll('.format-option.selected');
    return Array.from(selectedOptions).map(option => option.getAttribute('data-value'));
}

// 显示保存成功提示
function showSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    successMessage.style.display = 'flex';
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 2000); // 显示2秒钟
}

// 保存用户选择的格式和开关状态
document.getElementById('saveButton').addEventListener('click', function() {
    const twitterFormats = getSelectedFormats('twitterFormat');
    const pixivFormats = getSelectedFormats('pixivFormat');
    const twitterSwitchState = document.getElementById('twitterSwitch').checked;
    const pixivSwitchState = document.getElementById('pixivSwitch').checked;

    chrome.storage.sync.set({
        twitterFilenameFormat: twitterFormats,
        pixivFilenameFormat: pixivFormats,
        twitterSwitchActive: twitterSwitchState,
        pixivSwitchActive: pixivSwitchState
    }, function() {
        showSuccessMessage(); // 显示保存成功提示
    });
});

// 初始化选项按钮的选择状态
async function initSelection(containerId, storedFormats) {
    const container = document.getElementById(containerId);
    storedFormats.forEach(format => {
        const option = container.querySelector(`[data-value="${format}"]`);
        if (option) {
            option.classList.add('selected');
        }
    });

    if (containerId === 'twitterFormat') {
        await updateExample(containerId, 'twitterExample');
        await updateExample(containerId, 'twitterVideoExample');
    } else {
        const exampleId = containerId === 'pixivFormat' ? 'pixivExample' : 'twitterExample';
        await updateExample(containerId, exampleId);
    }
}

// 从存储中加载用户的选择并初始化界面
chrome.storage.sync.get(['twitterFilenameFormat', 'pixivFilenameFormat', 'twitterSwitchActive', 'pixivSwitchActive'], async function(result) {
    const twitterFormats = result.twitterFilenameFormat || ['account', 'tweetId'];
    const pixivFormats = result.pixivFilenameFormat || ['authorName', 'illustId'];

    // 默认将开关设置为打开（true）
    const twitterSwitch = (typeof result.twitterSwitchActive === 'undefined') ? true : result.twitterSwitchActive;
    const pixivSwitch = (typeof result.pixivSwitchActive === 'undefined') ? true : result.pixivSwitchActive;

    await initSelection('twitterFormat', twitterFormats);
    await initSelection('pixivFormat', pixivFormats);

    document.getElementById('twitterSwitch').checked = twitterSwitch;
    document.getElementById('pixivSwitch').checked = pixivSwitch;
});

// 绑定事件处理
toggleSelection('twitterFormat', 'twitterExample', 'twitterVideoExample');
toggleSelection('pixivFormat', 'pixivExample');
