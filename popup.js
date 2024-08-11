// popup.js

// 更新示例文件名
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

    exampleText = exampleText.slice(0, -1) + '.jpg'; // 去掉最后一个下划线并加上扩展名
    document.getElementById(exampleId).textContent = exampleText;
}

// 处理按钮点击选择并更新示例
function toggleSelection(containerId, exampleId) {
    const container = document.getElementById(containerId);
    container.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('format-option')) {
            target.classList.toggle('selected');
            updateExample(containerId, exampleId);
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

// 保存用户选择的格式
document.getElementById('saveButton').addEventListener('click', function() {
    const twitterFormats = getSelectedFormats('twitterFormat');
    const pixivFormats = getSelectedFormats('pixivFormat');

    chrome.storage.sync.set({
        twitterFilenameFormat: twitterFormats,
        pixivFilenameFormat: pixivFormats
    }, function() {
        showSuccessMessage(); // 显示保存成功提示
    });
});

// 初始化选项按钮的选择状态
function initSelection(containerId, storedFormats) {
    const container = document.getElementById(containerId);
    storedFormats.forEach(format => {
        const option = container.querySelector(`[data-value="${format}"]`);
        if (option) {
            option.classList.add('selected');
        }
    });
    const exampleId = containerId === 'twitterFormat' ? 'twitterExample' : 'pixivExample';
    updateExample(containerId, exampleId);
}

// 绑定事件处理
toggleSelection('twitterFormat', 'twitterExample');
toggleSelection('pixivFormat', 'pixivExample');

// 从存储中加载用户的选择并初始化界面
chrome.storage.sync.get(['twitterFilenameFormat', 'pixivFilenameFormat'], function(result) {
    const twitterFormats = result.twitterFilenameFormat || ['account', 'tweetId'];
    const pixivFormats = result.pixivFilenameFormat || ['illustId'];
    initSelection('twitterFormat', twitterFormats);
    initSelection('pixivFormat', pixivFormats);
});
