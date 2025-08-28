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
    container.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('format-option')) {
            target.classList.toggle('selected');
            updateExample(containerId, exampleId);
            // 如果提供了视频示例ID，也更新视频示例
            if (videoExampleId) {
                updateExample(containerId, videoExampleId);
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

// 从存储中加载用户的选择并初始化界面
chrome.storage.sync.get(['twitterFilenameFormat', 'pixivFilenameFormat', 'twitterSwitchActive', 'pixivSwitchActive'], function(result) {
    const twitterFormats = result.twitterFilenameFormat || ['account', 'tweetId'];
    const pixivFormats = result.pixivFilenameFormat || ['authorName', 'illustId'];
    
    // 默认将开关设置为打开（true）
    const twitterSwitch = (typeof result.twitterSwitchActive === 'undefined') ? true : result.twitterSwitchActive;
    const pixivSwitch = (typeof result.pixivSwitchActive === 'undefined') ? true : result.pixivSwitchActive;

    initSelection('twitterFormat', twitterFormats);
    initSelection('pixivFormat', pixivFormats);

    document.getElementById('twitterSwitch').checked = twitterSwitch;
    document.getElementById('pixivSwitch').checked = pixivSwitch;
});

// 绑定事件处理
toggleSelection('twitterFormat', 'twitterExample', 'twitterVideoExample');
toggleSelection('pixivFormat', 'pixivExample');
