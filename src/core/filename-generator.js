export class FilenameGenerator {
  constructor({ clock } = {}) {
    this.clock = clock || (() => new Date());
  }

  generate({ platform, formats, metadata, type, extension, resolution }) {
    const now = this.clock();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let filename = '';

    formats.forEach(format => {
      switch (format) {
        case 'account':
          filename += `${metadata.authorId || 'unknown'}_`;
          break;
        case 'tweetId':
          filename += `${metadata.tweetId || 'unknown'}_`;
          break;
        case 'tweetTime':
          filename += `${metadata.tweetTime || 'unknown'}_`;
          break;
        case 'authorName':
          filename += `${metadata.authorName || 'unknown'}_`;
          break;
        case 'authorId':
          filename += `${metadata.authorId || 'unknown'}_`;
          break;
        case 'illustId':
          filename += `${metadata.illustId || 'unknown'}_`;
          break;
        case 'downloadDate':
          filename += `${timestamp}_`;
          break;
        default:
          break;
      }
    });

    if (!filename) {
      filename = `${platform || 'download'}_${timestamp}_`;
    }

    const base = filename.slice(0, -1);
    if (type === 'video') {
      const resSuffix = resolution ? `_${resolution}` : '';
      return `${base}${resSuffix}.${extension || 'mp4'}`;
    }

    return `${base}.${extension || 'jpg'}`;
  }
}
