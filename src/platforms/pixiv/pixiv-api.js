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
