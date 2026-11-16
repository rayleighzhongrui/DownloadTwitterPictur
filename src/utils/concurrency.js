// 限流并发执行：结果保持输入顺序；worker 需自行捕获业务异常，
// 这样单个文件失败不会中断整批下载。
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const actualLimit = Math.max(1, Math.min(limit, items.length));

  async function runner() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: actualLimit }, () => runner()));
  return results;
}
