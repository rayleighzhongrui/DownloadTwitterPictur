import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorLogger } from '../src/utils/error-logger.js';

describe('ErrorLogger', () => {
  let storage;

  beforeEach(() => {
    storage = { errorLogs: [] };
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(keys => Promise.resolve({ [keys]: storage[keys] || [] })),
          set: vi.fn(items => {
            Object.assign(storage, items);
            return Promise.resolve();
          })
        }
      }
    };
  });

  it('写入日志后能从 getLogs 拿到', async () => {
    await ErrorLogger.log({ platform: 'twitter', action: 'foo', error: 'oops' });
    const logs = await ErrorLogger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ platform: 'twitter', action: 'foo', error: 'oops' });
    expect(logs[0].timestamp).toBeTruthy();
  });

  it('多条日志按时间倒序排列（最新在前）', async () => {
    await ErrorLogger.log({ platform: 'twitter', action: 'a', error: '1' });
    await ErrorLogger.log({ platform: 'twitter', action: 'b', error: '2' });
    await ErrorLogger.log({ platform: 'twitter', action: 'c', error: '3' });
    const logs = await ErrorLogger.getLogs();
    expect(logs.map(l => l.action)).toEqual(['c', 'b', 'a']);
  });

  it('并发写入不会互相覆盖（mutex 串行化）', async () => {
    const writes = Array.from({ length: 20 }, (_, i) =>
      ErrorLogger.log({ platform: 'twitter', action: `a${i}`, error: `e${i}` })
    );
    await Promise.all(writes);
    const logs = await ErrorLogger.getLogs();
    expect(logs).toHaveLength(20);
    // 所有写入都必须保留，没有竞态丢失
    const actions = logs.map(l => l.action).sort();
    expect(actions).toEqual(Array.from({ length: 20 }, (_, i) => `a${i}`).sort());
  });

  it('clear 清空日志', async () => {
    await ErrorLogger.log({ platform: 'twitter', action: 'a', error: '1' });
    await ErrorLogger.clear();
    const logs = await ErrorLogger.getLogs();
    expect(logs).toEqual([]);
  });

  it('日志条数上限 100', async () => {
    const writes = Array.from({ length: 105 }, (_, i) =>
      ErrorLogger.log({ platform: 'twitter', action: `a${i}`, error: `e${i}` })
    );
    await Promise.all(writes);
    const logs = await ErrorLogger.getLogs();
    expect(logs).toHaveLength(100);
    // 最旧的两条（a0、a1）被裁掉
    expect(logs.find(l => l.action === 'a0')).toBeUndefined();
    expect(logs.find(l => l.action === 'a1')).toBeUndefined();
  });
});
