chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "downloadImage" && request.url) {
    console.log('收到下载图片请求:', request.url); // 新增日志
    // 使用正则表达式确保作者ID安全用作文件名
    let safeAuthorId = request.authorId.replace(/[\\/\\\\:*?"<>|]/g, '_');
    
    // 获取当前时间并格式化为 "YYYY-MM-DD_HH" 格式
    let now = new Date();
    let timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}`;

    // 构建文件名，包含处理后的作者ID、时间戳，和文件扩展名
    let filename = `${safeAuthorId}_${timestamp}.jpg`;

    chrome.downloads.download({
      url: request.url,
      filename: filename // 使用包含时间戳的文件名
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        console.error('下载错误:', chrome.runtime.lastError); // 新增日志
      } else {
        console.log(`图片下载开始，ID: ${downloadId}`); // 新增日志
      }
    });
  }
});
