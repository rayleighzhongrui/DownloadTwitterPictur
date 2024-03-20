document.addEventListener('click', function(e) {
  if (e.target.closest('div[data-testid="like"]')) {
    const tweetContainer = e.target.closest('[data-testid="cellInnerDiv"]');
    if (tweetContainer) {
      const usernameSpans = tweetContainer.querySelectorAll('[data-testid="User-Name"] span');
      let authorIdParts = [];

      // 收集<span>标签的文本内容到数组中
      usernameSpans.forEach(span => {
        authorIdParts.push(span.textContent.trim());
      });

      // 去除数组的第一个和最后一个元素，只保留中间部分
      authorIdParts = authorIdParts.slice(1, -1);

      // 使用下划线将中间部分的文本片段拼接起来
      let authorId = authorIdParts.join('_');

      // 如果结果为空字符串，则使用默认值
      authorId = authorId || 'unknown_author';

      const images = tweetContainer.querySelectorAll('img');
      images.forEach((img) => {
        if (img.src.includes('pbs.twimg.com/media/')) {
          let imgUrl = new URL(img.src);
          imgUrl.searchParams.set('name', 'orig'); // 确保下载大图

          // 发送消息到background.js，包括图片URL和处理后的作者ID
          chrome.runtime.sendMessage({
            action: "downloadImage",
            url: imgUrl.toString(),
            authorId: authorId // 使用下划线拼接的中间部分作者ID作为文件名
          });
        }
      });
    }
  }
}, true);
