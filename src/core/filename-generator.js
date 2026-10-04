import { resolveExtension } from '../utils/file-type.js';

// 在主流桌面文件系统（Windows / macOS / Linux ext4 / FAT / NTFS）里都安全的字符集：
// 仅保留字母、数字、常见中日韩文字、点号、下划线、连字符、括号和空格。
// 其余全部替换为下划线，避免 chrome.downloads 静默失败。
const ILLEGAL = /[\\/:*?"<>|\x00-\x1f]/g; // eslint-disable-line no-control-regex
const MAX_LENGTH = 200;

function sanitize(name) {
  if (!name) return '';
  return String(name)
    .replace(ILLEGAL, '_')
    .replace(/[\s.]+$/, '')
    .replace(/^[.\s]+/, '')
    .slice(0, 80);
}

function sanitizeAll(parts) {
  return parts
    .map(sanitize)
    .filter(Boolean)
    .join('_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function trimLength(name) {
  if (name.length <= MAX_LENGTH) return name;
  // 保留扩展名前缀：先切掉中段
  const dot = name.lastIndexOf('.');
  if (dot > 0 && name.length - dot < 10) {
    const ext = name.slice(dot);
    return name.slice(0, MAX_LENGTH - ext.length) + ext;
  }
  return name.slice(0, MAX_LENGTH);
}

function pageSuffix(metadata) {
  const total = Number(metadata?.pageTotal);
  const index = Number(metadata?.pageIndex);
  if (!total || total <= 1) return '';
  if (!index || index < 1) return '';
  // 固定 2 位填充，覆盖 99% 的多图作品；99 页以上仍按 2 位（已能区分）
  return `_p${String(index).padStart(2, '0')}`;
}

export class FilenameGenerator {
  constructor({ clock } = {}) {
    this.clock = clock || (() => new Date());
  }

  generate({ platform, formats, metadata, type, extension, resolution, url }) {
    const now = this.clock();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const parts = [];

    for (const format of formats || []) {
      switch (format) {
        case 'account':
        case 'authorId':
          parts.push(metadata?.authorId);
          break;
        case 'authorName':
          parts.push(metadata?.authorName);
          break;
        case 'tweetId':
          parts.push(metadata?.tweetId);
          break;
        case 'tweetTime':
          parts.push(metadata?.tweetTime);
          break;
        case 'illustId':
          parts.push(metadata?.illustId);
          break;
        case 'downloadDate':
          parts.push(dateStr);
          break;
        case 'pageIndex':
          // 走 pageSuffix 统一处理
          break;
        default:
          break;
      }
    }

    let base = sanitizeAll(parts);
    if (!base) {
      base = `${platform || 'download'}_${dateStr}`;
    }

    // 多图作品附加页码（无论 formats 是否包含 pageIndex，都补上以避免重名）
    const suffix = pageSuffix(metadata);
    const finalExt = extension || resolveExtension(url || metadata?.url, type);

    if (type === 'video') {
      const res = resolution ? `_${resolution}` : '';
      return trimLength(`${base}${suffix}${res}.${finalExt || 'mp4'}`);
    }
    return trimLength(`${base}${suffix}.${finalExt || 'jpg'}`);
  }
}
