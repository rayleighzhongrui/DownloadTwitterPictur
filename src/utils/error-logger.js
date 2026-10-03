import { Storage } from './storage.js';

const LOG_KEY = 'errorLogs';
const MAX_LOGS = 100;

// 异步互斥：把所有 get-modify-set 操作串行化，避免并发写入时互相覆盖。
class Mutex {
  constructor() {
    this.tail = Promise.resolve();
  }

  run(fn) {
    const next = this.tail.then(fn, fn);
    // 阻止错误传染到后续调用
    this.tail = next.catch(() => {});
    return next;
  }
}

const mutex = new Mutex();

export class ErrorLogger {
  static async log(entry) {
    return mutex.run(async () => {
      const { errorLogs = [] } = await Storage.getLocal(LOG_KEY);
      const next = [
        {
          timestamp: new Date().toISOString(),
          ...entry
        },
        ...errorLogs
      ].slice(0, MAX_LOGS);
      await Storage.setLocal({ [LOG_KEY]: next });
    });
  }

  static async getLogs() {
    const { errorLogs = [] } = await Storage.getLocal(LOG_KEY);
    return errorLogs;
  }

  static async clear() {
    return mutex.run(async () => {
      await Storage.setLocal({ [LOG_KEY]: [] });
    });
  }
}
