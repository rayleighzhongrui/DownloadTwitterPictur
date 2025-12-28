import { Storage } from './storage.js';

const LOG_KEY = 'errorLogs';
const MAX_LOGS = 100;

export class ErrorLogger {
  static async log(entry) {
    const { errorLogs = [] } = await Storage.getLocal(LOG_KEY);
    const next = [
      {
        timestamp: new Date().toISOString(),
        ...entry
      },
      ...errorLogs
    ].slice(0, MAX_LOGS);
    await Storage.setLocal({ [LOG_KEY]: next });
  }

  static async getLogs() {
    const { errorLogs = [] } = await Storage.getLocal(LOG_KEY);
    return errorLogs;
  }

  static async clear() {
    await Storage.setLocal({ [LOG_KEY]: [] });
  }
}
