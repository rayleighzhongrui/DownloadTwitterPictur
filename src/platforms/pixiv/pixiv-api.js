/**
 * Pixiv 官方 AJAX 接口访问层。
 * 详情页数据来源：
 *   GET https://www.pixiv.net/ajax/illust/{id}
 *   GET https://www.pixiv.net/ajax/illust/{id}/pages
 * 返回结构（节选）：
 *   {
 *     illustId, illustTitle, illustType, userId, userName,
 *     pageCount, tags, url, description ...
 *   }
 *   pages: [{ urls: { original, regular, small }, width, height }, ...]
 *
 * 当代理域名被设置时，请求会改走代理（保留旧 ProxyManager 接口）。
 */

const META_URL = (id) => `https://www.pixiv.net/ajax/illust/${id}`;
const PAGES_URL = (id) => `https://www.pixiv.net/ajax/illust/${id}/pages`;

function asJson(response) {
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

// /ajax/* 元数据接口必须直连 www.pixiv.net：
// content script 运行在 pixiv.net 上，这是同源请求（无 CORS、cookie 自动携带），
// 反代通常只代理图片路径而不代理 /ajax，走反代只会 404。
// 注意：所有 /ajax 响应都包了一层 { error, message, body }，数据在 body 里。
async function fetchAjaxBody(url, label) {
  const data = await asJson(await fetch(url));
  if (!data || data.error) {
    throw new Error(data?.message || `${label} 返回错误`);
  }
  return data.body;
}

export async function fetchIllustMeta(illustId) {
  const body = await fetchAjaxBody(META_URL(illustId), `illust/${illustId}`);
  if (!body || !body.illustId) {
    throw new Error(`illust/${illustId} 响应缺少 body`);
  }
  return {
    illustId: body.illustId,
    illustTitle: body.illustTitle || '',
    userId: body.userId,
    userName: body.userName,
    pageCount: body.pageCount,
    // 单图作品 body.urls.original 直接就是原图
    originalUrl: body.urls?.original || null,
    tags: Array.isArray(body.tags?.tags) ? body.tags.tags.map(t => t.tag) : []
  };
}

export async function fetchIllustPages(illustId) {
  const body = await fetchAjaxBody(PAGES_URL(illustId), `illust/${illustId}/pages`);
  if (!Array.isArray(body)) {
    throw new Error(`illust/${illustId}/pages 返回结构异常`);
  }
  return body.map(p => ({
    width: p.width,
    height: p.height,
    urls: p.urls || {}
  }));
}

/**
 * 旧逻辑：从缩略图 URL 反推原图路径，作为 DOM 降级路径使用。
 * 保留是因为将来如果有代理降级场景，仍可能需要它。
 */
export function buildOriginalImageUrl(imgSrc, proxyDomain, illustId) {
  const standard = imgSrc.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_/);
  if (standard) {
    const [, year, month, day, hour, minute, second, matchedIllustId] = standard;
    const finalIllustId = illustId && illustId !== 'unknown_id' ? illustId : matchedIllustId;
    return {
      illustId: finalIllustId,
      url: `https://${proxyDomain}/img-original/img/${year}/${month}/${day}/${hour}/${minute}/${second}/${finalIllustId}_p0.png`
    };
  }

  const simple = imgSrc.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)_/);
  if (simple) {
    const [, year, month, day, matchedIllustId] = simple;
    const finalIllustId = illustId && illustId !== 'unknown_id' ? illustId : matchedIllustId;
    return {
      illustId: finalIllustId,
      url: `https://${proxyDomain}/img-original/img/${year}/${month}/${day}/00/00/00/${finalIllustId}_p0.png`
    };
  }

  return null;
}
