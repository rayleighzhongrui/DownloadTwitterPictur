document.addEventListener('click', function(e) {
  console.log('捕获到点击事件');

  // 处理Twitter点赞事件
  if (e.target.closest('[data-testid="like"]')) {
    console.log('已捕获Twitter点赞');
    const tweetContainer = e.target.closest('[data-testid="cellInnerDiv"]');
    if (tweetContainer) {
      const usernameSpans = tweetContainer.querySelectorAll('[data-testid="User-Name"] span');
      let authorIdParts = [];

      usernameSpans.forEach(span => {
        authorIdParts.push(span.textContent.trim());
      });

      authorIdParts = authorIdParts.slice(1, -1);
      let authorId = authorIdParts.join('_');
      authorId = authorId || 'unknown_author';

      console.log('获取的作者ID:', authorId);

      const images = tweetContainer.querySelectorAll('img');
      images.forEach((img) => {
        if (img.src.includes('pbs.twimg.com/media/')) {
          let imgUrl = new URL(img.src);
          imgUrl.searchParams.set('name', 'orig');

          console.log('已获取图片链接:', imgUrl.toString());

          chrome.runtime.sendMessage({
            action: "downloadImage",
            url: imgUrl.toString(),
            authorId: authorId
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('发送消息时发生错误:', chrome.runtime.lastError.message);
            } else {
              if (response.success) {
                console.log('图片下载成功，ID:', response.downloadId);
              } else {
                console.error('图片下载失败，错误:', response.error);
              }
            }
          });
        }
      });
    }
  }

  // 处理Pixiv点赞事件
  const bookmarkButton = e.target.closest('[class*=bookmark]') || e.target.closest('button.sc-kgq5hw-0.fgVkZi');
  if (bookmarkButton) {
    console.log('已捕获Pixiv点赞');
    console.log(bookmarkButton);
    let illustId = bookmarkButton.getAttribute('data-gtm-recommend-illust-id');
    if (!illustId) {
      const url = window.location.href;
      console.log('url:',url);
      const matches = url.match(/artworks\/(\d+)/);
      illustId = matches ? matches[1] : 'unknown_id';
    }
    console.log('获取的作品ID:', illustId);

    //let PivContainer = e.target.closest('[type="illust"]') || e.target.closest('[role="presentation"]') || e.target.closest('figure') ||  document.getElementById('targetElement');
    let PivContainer = document.querySelectorAll('figure');
    //let images = PivContainer.querySelectorAll('img') || PivContainer.querySelectorAll('a[href*="img-original"]');
    PivContainer.forEach((figure) => {
      console.log('find the figure element', figure);
      const images = figure.querySelectorAll('img');
      console.log('image url', images);

    images.forEach((img) => {
      console.log('检测到的图片URL:', img.src);
      let imgUrl = new URL(img.src);
      
      const matches = imgUrl.pathname.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_/);
      if (matches) {
        const [_, year, month, day, hour, minute, second, illustId] = matches;
        const originalImgUrl = `https://pixiv.zhongrui.app/img-original/img/${year}/${month}/${day}/${hour}/${minute}/${second}/${illustId}_p0.png`;
        console.log('转换后的图片链接:', originalImgUrl);

        const checkAndSendMessage = (url, isRetry) => {
          fetch(url, { method: 'HEAD' })
            .then(response => {
              if (response.ok) {
                console.log('图片存在，发送消息进行下载:', url);
                chrome.runtime.sendMessage({
                  action: "downloadImage",
                  url: url,
                  authorId: illustId
                }, function(response) {
                  if (chrome.runtime.lastError) {
                    console.error('发送消息时发生错误:', chrome.runtime.lastError.message);
                  } else {
                    if (response.success) {
                      console.log('图片下载成功，ID:', response.downloadId);
                    } else {
                      console.error('图片下载失败，错误:', response.error);
                    }
                  }
                });
              } else {
                throw new Error('图片请求失败');
              }
            })
            .catch(error => {
              console.error('请求错误:', error.message);

              // 如果发生错误且这是第一次尝试，将 .png 替换为 .jpg 并重试
              if (!isRetry) {
                let retryUrl = url.replace('.png', '.jpg');
                console.log('重试下载图片链接:', retryUrl);
                setTimeout(() => checkAndSendMessage(retryUrl, true), 500);  // 增加一点延时再重试
              } else {
                console.error('重试下载也失败:', error.message);
              }
            });
        };

        checkAndSendMessage(originalImgUrl, false);
      } else {
        console.log('未找到匹配的时间戳和作品ID');
      }
    });
  });
  }
}, true);
