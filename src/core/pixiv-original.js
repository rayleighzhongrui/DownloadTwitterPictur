// chrome.downloads 的浏览器级请求不会可靠地应用 DNR 的 Referer 规则，
// 且 downloads API 禁止直接设置 Referer。直连兜底必须先由后台 fetch 获取原图：
// 该请求受现有 i.pximg.net host permission + xmlhttprequest Referer 规则保护。
// Service worker 没有 URL.createObjectURL，使用 data URL 交给原下载链路落盘。
export async function fetchPixivOriginalDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (!mime.startsWith('image/') && mime !== 'application/octet-stream') {
    throw new Error('Pixiv original response is not an image');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  // 避免对大图使用一次性展开导致调用栈溢出。
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
