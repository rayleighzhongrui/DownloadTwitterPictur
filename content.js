document.addEventListener('click', function(e) {
  console.log('捕获到点击事件');

  // 处理Twitter点赞事件
  if (e.target.closest('[data-testid="like"]')) {
      console.log('已捕获Twitter点赞');
      const tweetContainer = e.target.closest('[data-testid="cellInnerDiv"]');
      if (tweetContainer) {
        const usernameSpans = tweetContainer.querySelectorAll('[data-testid="User-Name"] span');
        let authorId = 'unknown_author';  // 默认作者ID

        // 遍历所有span，寻找包含 "@" 的项
        usernameSpans.forEach(span => {
            const textContent = span.textContent.trim();
            if (textContent.includes('@')) {
                authorId = textContent;  // 找到包含 "@" 的文本，即为作者ID
            }
        });
          //console.log('账号信息', authorIdParts)
          //authorIdParts = authorIdParts.slice(3, -1);
          //let authorId = authorIdParts.join('_');
          //authorId = authorId || 'unknown_author';

          console.log('获取的作者ID:', authorId);
          
          // 获取推特ID
          let tweetId = tweetContainer.getAttribute('data-tweet-id');
          if (!tweetId) {
              const tweetLink = tweetContainer.querySelector('a[href*="/status/"]');
              if (tweetLink) {
                  const match = tweetLink.href.match(/status\/(\d+)/);
                  if (match) {
                      tweetId = match[1];
                  }
              }
          }
          tweetId = tweetId || 'unknown_tweet_id';
          console.log('获取的推特ID:', tweetId); // 新增日志

          const images = tweetContainer.querySelectorAll('img');
          images.forEach((img) => {
              if (img.src.includes('pbs.twimg.com/media/')) {
                  let imgUrl = new URL(img.src);
                  imgUrl.searchParams.set('name', 'orig');

                  console.log('已获取图片链接:', imgUrl.toString());

                  chrome.runtime.sendMessage({
                      action: "downloadImage",
                      url: imgUrl.toString(),
                      authorId: authorId,
                      tweetId: tweetId,
                      platform: 'twitter' // 添加平台信息
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
      const url = window.location.href;
      let illustId;
      let images = [];
      let totalImages = 1; // 默认值

      if (url.startsWith('https://www.pixiv.net/artworks/')) {
          // Pixiv作品页面逻辑
          const matches = url.match(/artworks\/(\d+)/);
          illustId = matches ? matches[1] : 'unknown_id';
          const figure = document.querySelector('figure');
          if (figure) {
              images = figure.querySelectorAll('img');
              const span = figure.querySelector('span[class*="sc-1mr081w-0"]'); // 获取包含数字的span
              if (span) {
                  const spanValue = parseInt(span.childNodes[2].textContent, 10); // 获取包含数字的文本节点
                  if (!isNaN(spanValue)) {
                      totalImages = spanValue;
                  }
              }
          }
      } else if (url.startsWith('https://www.pixiv.net/')) {
          // Pixiv首页逻辑
          const nearestIllust = e.target.closest('[type="illust"]');
          if (nearestIllust) {
              illustId = nearestIllust.getAttribute('data-gtm-value');
              images = nearestIllust.querySelectorAll('img');
              const spans = nearestIllust.querySelectorAll('span');
              spans.forEach(span => {
                  const spanValue = parseInt(span.textContent, 10);
                  if (!isNaN(spanValue)) {
                      totalImages = spanValue;
                  }
              });
          }
      } else {
          // 其他页面逻辑，暂时同Pixiv首页逻辑
          console.log('当前页面为其他页面，按Pixiv首页逻辑处理');
          const nearestIllust = e.target.closest('[type="illust"]');
          if (nearestIllust) {
              illustId = nearestIllust.getAttribute('data-gtm-value');
              images = nearestIllust.querySelectorAll('img');
              const span = nearestIllust.querySelector('span[class*="sc-1mr081w-0"]'); // 获取包含数字的span
              if (span) {
                  const spanValue = parseInt(span.childNodes[2].textContent, 10); // 获取包含数字的文本节点
                  if (!isNaN(spanValue)) {
                      totalImages = spanValue;
                  }
              }
          }
      }

      console.log('获取的作品ID:', illustId);
      console.log('作品图片总数:', totalImages);

      const checkAndSendMessage = (url, illustId, index, totalImages, isRetry) => {
          fetch(url, { method: 'HEAD' })
              .then(response => {
                  if (response.ok) {
                      console.log('图片存在，发送消息进行下载:', url);
                      chrome.runtime.sendMessage({
                          action: "downloadImage",
                          url: url,
                          illustId: illustId,
                          platform: 'pixiv' // 添加平台信息
                      }, function(response) {
                          if (chrome.runtime.lastError) {
                              console.error('发送消息时发生错误:', chrome.runtime.lastError.message);
                          } else {
                              if (response.success) {
                                  console.log('图片下载成功，ID:', response.downloadId);
                              } else {
                                  console.error('图片下载失败，错误:', response.error);
                              }
                              if (index + 1 < totalImages) {
                                  const nextUrl = url.replace(`_p${index}`, `_p${index + 1}`);
                                  checkAndSendMessage(nextUrl, illustId, index + 1, totalImages, false); // 递归下载下一张图片
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
                      setTimeout(() => checkAndSendMessage(retryUrl, illustId, index, totalImages, true), 500); // 增加一点延时再重试
                  } else {
                      console.error('重试下载也失败:', error.message);
                      if (index + 1 < totalImages) {
                          const nextUrl = url.replace(`_p${index}`, `_p${index + 1}`);
                          checkAndSendMessage(nextUrl, illustId, index + 1, totalImages, false); // 尝试下载下一张图片
                      }
                  }
              });
      };

      images.forEach((img) => {
          console.log('检测到的图片URL:', img.src);
          let imgUrl = new URL(img.src);

          const matches = imgUrl.pathname.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_/);
          if (matches) {
              const [_, year, month, day, hour, minute, second, illustId] = matches;
              const originalImgUrl = `https://pixiv.zhongrui.app/img-original/img/${year}/${month}/${day}/${hour}/${minute}/${second}/${illustId}_p0.png`;
              console.log('转换后的图片链接:', originalImgUrl);

              checkAndSendMessage(originalImgUrl, illustId, 0, totalImages, false);
          } else {
              console.log('未找到匹配的时间戳和作品ID');
          }
      });
  }
}, true);
