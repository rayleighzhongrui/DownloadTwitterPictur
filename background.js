(() => {
  // src/utils/storage.js
  var Storage = {
    async getSync(keys) {
      return chrome.storage.sync.get(keys);
    },
    async setSync(items) {
      return chrome.storage.sync.set(items);
    },
    async getLocal(keys) {
      return chrome.storage.local.get(keys);
    },
    async setLocal(items) {
      return chrome.storage.local.set(items);
    }
  };

  // src/core/config.js
  var DEFAULTS = {
    twitterSwitchActive: true,
    pixivSwitchActive: true,
    notificationsEnabled: true,
    twitterFilenameFormat: ["account", "tweetId"],
    pixivFilenameFormat: ["authorName", "illustId"]
  };
  var ConfigManager = class {
    async getSwitches() {
      const result = await Storage.getSync(["twitterSwitchActive", "pixivSwitchActive"]);
      return {
        twitterSwitchActive: typeof result.twitterSwitchActive === "undefined" ? DEFAULTS.twitterSwitchActive : result.twitterSwitchActive,
        pixivSwitchActive: typeof result.pixivSwitchActive === "undefined" ? DEFAULTS.pixivSwitchActive : result.pixivSwitchActive
      };
    }
    async getFilenameFormats() {
      const result = await Storage.getSync(["twitterFilenameFormat", "pixivFilenameFormat"]);
      return {
        twitterFilenameFormat: result.twitterFilenameFormat || DEFAULTS.twitterFilenameFormat,
        pixivFilenameFormat: result.pixivFilenameFormat || DEFAULTS.pixivFilenameFormat
      };
    }
    async getNotificationSetting() {
      const result = await Storage.getSync("notificationsEnabled");
      return typeof result.notificationsEnabled === "undefined" ? DEFAULTS.notificationsEnabled : result.notificationsEnabled;
    }
    async setSettings(settings) {
      await Storage.setSync(settings);
    }
  };

  // src/utils/file-type.js
  var KNOWN_IMAGE_EXTS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "gif", "webp"]);
  var KNOWN_VIDEO_EXTS = /* @__PURE__ */ new Set(["mp4", "webm", "mov"]);
  function normalizeExtension(ext) {
    if (!ext)
      return null;
    const clean = String(ext).toLowerCase().replace(/^\.+/, "").trim();
    if (clean === "jpeg")
      return "jpg";
    if (KNOWN_IMAGE_EXTS.has(clean) || KNOWN_VIDEO_EXTS.has(clean)) {
      return clean;
    }
    return null;
  }
  function resolveExtension(url, type = "image") {
    const fallback = type === "video" ? "mp4" : "jpg";
    if (!url || typeof url !== "string") {
      return fallback;
    }
    try {
      const parsed = new URL(url, "https://dummy.local");
      const formatParam = parsed.searchParams.get("format");
      const normalizedFromParam = normalizeExtension(formatParam);
      if (normalizedFromParam) {
        return normalizedFromParam;
      }
      const cleanPath = parsed.pathname.split(":")[0];
      const lastSlash = cleanPath.lastIndexOf("/");
      const filenamePart = lastSlash >= 0 ? cleanPath.slice(lastSlash + 1) : cleanPath;
      const lastDot = filenamePart.lastIndexOf(".");
      if (lastDot >= 0) {
        const extCandidate = filenamePart.slice(lastDot + 1);
        const normalizedFromPath = normalizeExtension(extCandidate);
        if (normalizedFromPath) {
          return normalizedFromPath;
        }
      }
    } catch {
    }
    return fallback;
  }

  // src/core/filename-generator.js
  var ILLEGAL = /[\\/:*?"<>|\x00-\x1f]/g;
  var MAX_LENGTH = 200;
  function sanitize(name) {
    if (!name)
      return "";
    return String(name).replace(ILLEGAL, "_").replace(/[\s.]+$/, "").replace(/^[.\s]+/, "").slice(0, 80);
  }
  function sanitizeAll(parts) {
    return parts.map(sanitize).filter(Boolean).join("_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }
  function trimLength(name) {
    if (name.length <= MAX_LENGTH)
      return name;
    const dot = name.lastIndexOf(".");
    if (dot > 0 && name.length - dot < 10) {
      const ext = name.slice(dot);
      return name.slice(0, MAX_LENGTH - ext.length) + ext;
    }
    return name.slice(0, MAX_LENGTH);
  }
  function pageSuffix(metadata) {
    const total = Number(metadata?.pageTotal);
    const index = Number(metadata?.pageIndex);
    if (!total || total <= 1)
      return "";
    if (!index || index < 1)
      return "";
    return `_p${String(index).padStart(2, "0")}`;
  }
  var FilenameGenerator = class {
    constructor({ clock } = {}) {
      this.clock = clock || (() => /* @__PURE__ */ new Date());
    }
    generate({ platform, formats, metadata, type, extension, resolution, url }) {
      const now = this.clock();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const parts = [];
      for (const format of formats || []) {
        switch (format) {
          case "account":
          case "authorId":
            parts.push(metadata?.authorId);
            break;
          case "authorName":
            parts.push(metadata?.authorName);
            break;
          case "tweetId":
            parts.push(metadata?.tweetId);
            break;
          case "tweetTime":
            parts.push(metadata?.tweetTime);
            break;
          case "illustId":
            parts.push(metadata?.illustId);
            break;
          case "downloadDate":
            parts.push(dateStr);
            break;
          case "pageIndex":
            break;
          default:
            break;
        }
      }
      let base = sanitizeAll(parts);
      if (!base) {
        base = `${platform || "download"}_${dateStr}`;
      }
      const suffix = pageSuffix(metadata);
      const finalExt = extension || resolveExtension(url || metadata?.url, type);
      if (type === "video") {
        const res = resolution ? `_${resolution}` : "";
        return trimLength(`${base}${suffix}${res}.${finalExt || "mp4"}`);
      }
      return trimLength(`${base}${suffix}.${finalExt || "jpg"}`);
    }
  };

  // src/utils/retry.js
  var RetryManager = class {
    constructor({ maxRetries = 5, baseDelay = 1e3, isRetryable } = {}) {
      this.maxRetries = maxRetries;
      this.baseDelay = baseDelay;
      this.isRetryable = isRetryable || this.defaultRetryable;
    }
    async retry(fn, { name = "\u4EFB\u52A1", onRetry } = {}) {
      let lastError;
      for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
        try {
          return await fn(attempt);
        } catch (error) {
          lastError = error;
          if (!this.isRetryable(error)) {
            throw error;
          }
          const delay = this.baseDelay * Math.pow(2, attempt);
          if (typeof onRetry === "function") {
            onRetry({ attempt, delay, error, name });
          }
          await this.sleep(delay);
        }
      }
      throw new Error(`${name}: \u5931\u8D25 ${this.maxRetries} \u6B21\u540E\u653E\u5F03\u3002\u6700\u540E\u9519\u8BEF: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`);
    }
    defaultRetryable(error) {
      const message = error?.message || "";
      const status = error?.status || error?.response?.status;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      const networkErrors = [
        "ETIMEDOUT",
        "ECONNRESET",
        "ENOTFOUND",
        "Connection reset"
      ];
      const isNetworkError = networkErrors.some((msg) => message.includes(msg));
      const isServerError = status && status >= 500 && status < 600;
      const isTimeoutError = message.includes("timeout") || message.includes("Timeout");
      return isNetworkError || isServerError || isTimeoutError;
    }
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  };

  // src/utils/i18n.js
  function t(key, substitutions = [], fallback = "") {
    try {
      const msg = chrome.i18n.getMessage(key, substitutions);
      if (msg)
        return msg;
    } catch (e) {
    }
    return fallback;
  }

  // src/utils/notifier.js
  var PROGRESS_ID = "batch-progress";
  var Notifier = class {
    static showSuccess(title, message) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "images/icon.png",
        title,
        message
      });
    }
    static showWarning(title, message) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "images/icon.png",
        title,
        message,
        priority: 1
      });
    }
    static showError(title, message) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "images/icon.png",
        title,
        message,
        requireInteraction: true,
        priority: 2
      });
    }
    // 进度通知使用固定 ID 复用同一条通知，避免批量下载时刷屏。
    // update 的目标不存在时（首次或通知被用户关闭）回退到 create。
    static showProgress(current, total) {
      const options = {
        type: "progress",
        iconUrl: "images/icon.png",
        title: t("notifBatchTitle", [], "\u6279\u91CF\u4E0B\u8F7D\u4E2D"),
        message: t("notifBatchProgress", [String(current), String(total)], `\u5DF2\u5B8C\u6210 ${current}/${total}`),
        progress: total > 0 ? Math.round(current / total * 100) : 0
      };
      chrome.notifications.update(PROGRESS_ID, options, (wasUpdated) => {
        if (chrome.runtime.lastError || !wasUpdated) {
          chrome.notifications.create(PROGRESS_ID, options);
        }
      });
    }
    static clearProgress() {
      chrome.notifications.clear(PROGRESS_ID);
    }
  };

  // src/utils/error-logger.js
  var LOG_KEY = "errorLogs";
  var MAX_LOGS = 100;
  var Mutex = class {
    constructor() {
      this.tail = Promise.resolve();
    }
    run(fn) {
      const next = this.tail.then(fn, fn);
      this.tail = next.catch(() => {
      });
      return next;
    }
  };
  var mutex = new Mutex();
  var ErrorLogger = class {
    static async log(entry) {
      return mutex.run(async () => {
        const { errorLogs = [] } = await Storage.getLocal(LOG_KEY);
        const next = [
          {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
  };

  // src/core/pixiv-original.js
  async function fetchPixivOriginalDataUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const mime = (response.headers.get("content-type") || "").split(";")[0].trim();
    if (!mime.startsWith("image/") && mime !== "application/octet-stream") {
      throw new Error("Pixiv original response is not an image");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }

  // src/background.js
  var configManager = new ConfigManager();
  var filenameGenerator = new FilenameGenerator();
  var retryManager = new RetryManager();
  var configCache = {
    formats: null,
    notificationsEnabled: null,
    hydrated: false
  };
  async function ensureHydrated() {
    if (configCache.hydrated)
      return;
    const [formats, notificationsEnabled] = await Promise.all([
      configManager.getFilenameFormats(),
      configManager.getNotificationSetting()
    ]);
    configCache.formats = formats;
    configCache.notificationsEnabled = notificationsEnabled;
    configCache.hydrated = true;
  }
  function invalidate(changes) {
    if ("twitterFilenameFormat" in changes || "pixivFilenameFormat" in changes) {
      configCache.formats = null;
      configCache.hydrated = false;
    }
    if ("notificationsEnabled" in changes) {
      configCache.notificationsEnabled = null;
      configCache.hydrated = false;
    }
  }
  var downloadMetaCache = /* @__PURE__ */ new Map();
  async function downloadWithRetry(request, type) {
    await ensureHydrated();
    const formats = configCache.formats;
    const notificationsEnabled = configCache.notificationsEnabled;
    const formatList = request.platform === "pixiv" ? formats.pixivFilenameFormat : formats.twitterFilenameFormat;
    const extension = request.extension || resolveExtension(request.url, type);
    const filename = filenameGenerator.generate({
      platform: request.platform,
      formats: formatList,
      metadata: request,
      type,
      extension,
      url: request.url,
      resolution: request.resolution
    });
    let downloadUrl;
    const downloadTask = async () => {
      if (!downloadUrl) {
        downloadUrl = request.platform === "pixiv" && new URL(request.url).hostname === "i.pximg.net" ? await fetchPixivOriginalDataUrl(request.url) : request.url;
      }
      return new Promise((resolve, reject) => {
        chrome.downloads.download({ url: downloadUrl, filename, saveAs: false }, (downloadId) => {
          if (chrome.runtime.lastError) {
            const error = new Error(chrome.runtime.lastError.message);
            return reject(error);
          }
          resolve(downloadId);
        });
      });
    };
    const isBatchItem = Number(request.pageTotal) > 1;
    try {
      const downloadId = await retryManager.retry(downloadTask, {
        name: type === "video" ? "\u89C6\u9891\u4E0B\u8F7D" : "\u56FE\u7247\u4E0B\u8F7D",
        onRetry: ({ attempt }) => {
          if (attempt === 2 && notificationsEnabled) {
            Notifier.showWarning(
              t("notifRetryTitle", [], "\u4E0B\u8F7D\u91CD\u8BD5\u4E2D"),
              t("notifRetryGeneric", [], "\u7F51\u7EDC\u6CE2\u52A8\u5BFC\u81F4\u5931\u8D25\uFF0C\u6B63\u5728\u91CD\u8BD5\u2026")
            );
          }
        }
      });
      downloadMetaCache.set(downloadId, { platform: request.platform, url: request.url, filename });
      if (notificationsEnabled && !isBatchItem) {
        Notifier.showSuccess(
          t("notifQueuedTitle", [], "\u4E0B\u8F7D\u5F00\u59CB"),
          t(type === "video" ? "notifQueuedVideo" : "notifQueuedImage", [], "\u5DF2\u52A0\u5165\u4E0B\u8F7D\u961F\u5217")
        );
      }
      return { success: true, downloadId };
    } catch (error) {
      await ErrorLogger.log({
        platform: request.platform,
        action: type === "video" ? "downloadVideo" : "downloadImage",
        url: request.url,
        error: error.message,
        retryCount: retryManager.maxRetries,
        success: false
      });
      if (notificationsEnabled) {
        Notifier.showError(
          t("notifFailedTitle", [], "\u4E0B\u8F7D\u5931\u8D25"),
          t("notifFailedMessage", [error.message], `\u4E0B\u8F7D\u5931\u8D25\uFF1A${error.message}`)
        );
      }
      return { success: false, error: error.message };
    }
  }
  var batchProgress = /* @__PURE__ */ new Map();
  function handleDownloadProgress({ batchKey, current, total }) {
    const key = batchKey || "default";
    const prev = batchProgress.get(key) || { current: 0, total: 0 };
    batchProgress.set(key, {
      current: Math.max(prev.current, Number(current) || 0),
      total: Math.max(prev.total, Number(total) || 0)
    });
    let done = 0;
    let sum = 0;
    for (const batch of batchProgress.values()) {
      done += batch.current;
      sum += batch.total;
    }
    if (done < sum) {
      Notifier.showProgress(done, sum);
      return;
    }
    batchProgress.clear();
    Notifier.clearProgress();
    if (sum > 0) {
      Notifier.showSuccess(
        t("notifBatchDoneTitle", [], "\u6279\u91CF\u4E0B\u8F7D\u5B8C\u6210"),
        t("notifBatchDoneMessage", [String(sum)], `\u5171 ${sum} \u4E2A\u6587\u4EF6\u5DF2\u52A0\u5165\u4E0B\u8F7D\u961F\u5217`)
      );
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync")
      invalidate(changes);
  });
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadImage" && request.url) {
      downloadWithRetry(request, "image").then(sendResponse);
      return true;
    }
    if (request.action === "downloadVideo" && request.url) {
      downloadWithRetry(request, "video").then(sendResponse);
      return true;
    }
    if (request.action === "notify") {
      ensureHydrated().then(() => {
        if (!configCache.notificationsEnabled)
          return;
        if (request.level === "warning") {
          Notifier.showWarning(request.title, request.message);
        } else if (request.level === "error") {
          Notifier.showError(request.title, request.message);
        } else {
          Notifier.showSuccess(request.title, request.message);
        }
      });
    }
    if (request.action === "downloadProgress") {
      ensureHydrated().then(() => {
        if (configCache.notificationsEnabled) {
          handleDownloadProgress(request);
        } else {
          batchProgress.clear();
          Notifier.clearProgress();
        }
      });
    }
  });
  chrome.downloads.onChanged.addListener((delta) => {
    if (!delta.state)
      return;
    if (delta.state.current === "complete") {
      downloadMetaCache.delete(delta.id);
      return;
    }
    if (delta.state.current !== "interrupted")
      return;
    const meta = downloadMetaCache.get(delta.id) || {};
    downloadMetaCache.delete(delta.id);
    const error = delta.error && delta.error.current || "INTERRUPTED";
    chrome.downloads.search({ id: delta.id }, (items) => {
      const item = Array.isArray(items) ? items[0] : null;
      const filePath = item && item.filename || meta.filename || "";
      const file = filePath.split(/[\\/]/).pop() || "";
      ErrorLogger.log({
        platform: meta.platform || "unknown",
        action: "downloadInterrupted",
        url: meta.url || item && (item.finalUrl || item.url) || "",
        error,
        success: false
      });
      ensureHydrated().then(() => {
        if (!configCache.notificationsEnabled)
          return;
        Notifier.showError(
          t("notifInterruptedTitle", [], "\u4E0B\u8F7D\u5DF2\u4E2D\u65AD"),
          t("notifInterruptedMessage", [file || "-", error], `${file} ${error}`)
        );
      });
    });
  });
})();
//# sourceMappingURL=background.js.map
