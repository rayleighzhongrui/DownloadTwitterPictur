chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "downloadImage" && request.url) {
    console.log('收到下载图片请求:', request.url); // 新增日志
    let safeAuthorId = request.authorId.replace(/[\\/\\\\:*?"<>|]/g, '_');
    
    let now = new Date();
    let timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}`;

    let filename = `${safeAuthorId}_${timestamp}.jpg`;

    chrome.downloads.download({
      url: request.url,
      filename: filename 
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        //console.error('下载错误:', chrome.runtime.lastError); // 新增日志
        sendResponse({ success: false, error: chrome.runtime.lastError });
      } else {
        console.log(`图片下载开始，ID: ${downloadId}`); // 新增日志
        sendResponse({ success: true, downloadId: downloadId });
      }
    });

    // 表示响应将异步发送
    return true;
  }
});
