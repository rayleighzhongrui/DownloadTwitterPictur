const KNOWN_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const KNOWN_VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);

function normalizeExtension(ext) {
  if (!ext) return null;
  const clean = String(ext).toLowerCase().replace(/^\.+/, '').trim();
  if (clean === 'jpeg') return 'jpg';
  if (KNOWN_IMAGE_EXTS.has(clean) || KNOWN_VIDEO_EXTS.has(clean)) {
    return clean;
  }
  return null;
}

/**
 * 从 URL 及可选类型中智能推断文件真实扩展名
 *
 * 覆盖场景：
 * 1. Pixiv 原图路径：https://i.pximg.net/.../150410354_p0.png -> 'png'
 * 2. Twitter 现代查询参数：https://pbs.twimg.com/media/xxx?format=png&name=orig -> 'png'
 * 3. Twitter 旧式路径扩展名带修饰符：https://pbs.twimg.com/media/xxx.jpg:orig -> 'jpg'
 * 4. 视频媒体路径：https://video.twimg.com/.../xxx.mp4?tag=12 -> 'mp4'
 * 5. 无法解析时的兜底：type === 'video' ? 'mp4' : 'jpg'
 *
 * @param {string} url - 目标资源的下载地址
 * @param {'image'|'video'} [type='image'] - 媒体类别
 * @returns {string} 归一化后的扩展名（如 'png', 'jpg', 'mp4'）
 */
export function resolveExtension(url, type = 'image') {
  const fallback = type === 'video' ? 'mp4' : 'jpg';
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  try {
    const parsed = new URL(url, 'https://dummy.local');

    // 1. 优先读取 URL 查询参数（如 Twitter 的 ?format=png）
    const formatParam = parsed.searchParams.get('format');
    const normalizedFromParam = normalizeExtension(formatParam);
    if (normalizedFromParam) {
      return normalizedFromParam;
    }

    // 2. 从 pathname 提取（剥离 :orig 等后缀）
    // 例如 /media/abc.jpg:large -> /media/abc.jpg
    const cleanPath = parsed.pathname.split(':')[0];
    const lastSlash = cleanPath.lastIndexOf('/');
    const filenamePart = lastSlash >= 0 ? cleanPath.slice(lastSlash + 1) : cleanPath;
    const lastDot = filenamePart.lastIndexOf('.');
    if (lastDot >= 0) {
      const extCandidate = filenamePart.slice(lastDot + 1);
      const normalizedFromPath = normalizeExtension(extCandidate);
      if (normalizedFromPath) {
        return normalizedFromPath;
      }
    }
  } catch {
    // URL 解析异常时走兜底
  }

  return fallback;
}
