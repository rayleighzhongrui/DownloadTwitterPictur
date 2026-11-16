import { describe, it, expect } from 'vitest';
import { mapLimit } from '../src/utils/concurrency.js';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

describe('mapLimit', () => {
  it('keeps result order regardless of completion order', async () => {
    const gates = [deferred(), deferred(), deferred()];
    const items = ['a', 'b', 'c'];
    const promise = mapLimit(items, 3, item => gates[items.indexOf(item)].promise.then(() => item));

    // 逆序 resolve，结果顺序仍应与输入一致
    gates[2].resolve();
    gates[0].resolve();
    gates[1].resolve();

    const results = await promise;
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;

    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapLimit(items, 3, async n => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 5));
      active -= 1;
      return n;
    });

    expect(peak).toBe(3);
  });

  it('propagates worker rejections', async () => {
    const items = [1, 2, 3];
    await expect(mapLimit(items, 2, n => {
      if (n === 2) return Promise.reject(new Error('boom'));
      return Promise.resolve(n);
    })).rejects.toThrow('boom');
  });

  it('handles empty input', async () => {
    const results = await mapLimit([], 3, n => n);
    expect(results).toEqual([]);
  });

  it('caps limit at item count', async () => {
    let active = 0;
    let peak = 0;
    await mapLimit([1], 5, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 5));
      active -= 1;
    });
    expect(peak).toBe(1);
  });
});
