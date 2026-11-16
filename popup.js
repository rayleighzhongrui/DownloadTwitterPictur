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

  // src/popup.js
  var DEFAULT_TWITTER_FORMATS = ["account", "tweetId"];
  var DEFAULT_PIXIV_FORMATS = ["authorName", "illustId"];
  var FORMAT_PART_KEYS = {
    account: "examplePartAccount",
    tweetId: "examplePartTweetId",
    tweetTime: "examplePartTweetTime",
    authorName: "examplePartAuthorName",
    authorId: "examplePartAuthorId",
    illustId: "examplePartIllustId",
    downloadDate: "examplePartDownloadDate"
  };
  var FORMAT_PART_FALLBACKS = {
    account: "exampleUser_",
    tweetId: "88669977_",
    tweetTime: "20230810_",
    authorName: "exampleAuthor_",
    authorId: "12345_",
    illustId: "88669977_",
    downloadDate: "20230811_"
  };
  var state = {
    orders: {
      twitterFormat: [...DEFAULT_TWITTER_FORMATS],
      pixivFormat: [...DEFAULT_PIXIV_FORMATS]
    }
  };
  function applyI18n() {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
      const msg = t(element.getAttribute("data-i18n"));
      if (msg) {
        element.textContent = msg;
      }
    });
    const titleElement = document.querySelector("title[data-i18n]");
    if (titleElement) {
      const msg = t(titleElement.getAttribute("data-i18n"));
      if (msg) {
        document.title = msg;
      }
    }
    const uiLang = typeof chrome !== "undefined" && chrome.i18n?.getUILanguage?.();
    if (uiLang) {
      document.documentElement.lang = uiLang;
    }
  }
  var toastTimer = null;
  function showToast(message) {
    const el = document.getElementById("toast");
    if (!el)
      return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
  }
  var pendingSaves = /* @__PURE__ */ new Map();
  var saveTimer = null;
  function queueSave(entries) {
    for (const [key, value] of Object.entries(entries)) {
      pendingSaves.set(key, value);
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSaves, 200);
  }
  async function flushSaves() {
    if (pendingSaves.size === 0)
      return;
    const items = Object.fromEntries(pendingSaves);
    pendingSaves.clear();
    try {
      await Storage.setSync(items);
      showToast(t("savedToast", [], "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58"));
    } catch (error) {
      showToast(String(error?.message || error));
    }
  }
  var STORAGE_KEYS = {
    twitterFormat: "twitterFilenameFormat",
    pixivFormat: "pixivFilenameFormat"
  };
  function renderFormatSelection(containerId) {
    const container = document.getElementById(containerId);
    if (!container)
      return;
    const order = state.orders[containerId];
    container.querySelectorAll(".format-option").forEach((option) => {
      const value = option.getAttribute("data-value");
      const index = order.indexOf(value);
      option.classList.toggle("selected", index >= 0);
      option.setAttribute("aria-pressed", index >= 0 ? "true" : "false");
      if (index >= 0) {
        option.setAttribute("data-pos", String(index + 1));
      } else {
        option.removeAttribute("data-pos");
      }
    });
  }
  function formatDate(d) {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }
  function updateExamples(containerId) {
    const order = state.orders[containerId];
    const platform = containerId === "twitterFormat" ? "twitter" : "pixiv";
    let base = "";
    for (const format of order) {
      base += t(FORMAT_PART_KEYS[format], [], FORMAT_PART_FALLBACKS[format] || "");
    }
    if (!base) {
      base = `${platform}_${formatDate(/* @__PURE__ */ new Date())}_`;
    }
    const imageEl = document.getElementById(containerId === "twitterFormat" ? "twitterExample" : "pixivExample");
    if (imageEl)
      imageEl.textContent = `${base.slice(0, -1)}.jpg`;
    if (containerId === "twitterFormat") {
      const videoEl = document.getElementById("twitterVideoExample");
      if (videoEl)
        videoEl.textContent = `${base.slice(0, -1)}_1920x1080.mp4`;
    }
  }
  function bindFormatSelection(containerId) {
    const container = document.getElementById(containerId);
    if (!container)
      return;
    container.addEventListener("click", (event) => {
      const option = event.target.closest(".format-option");
      if (!option)
        return;
      const value = option.getAttribute("data-value");
      const order = state.orders[containerId];
      const index = order.indexOf(value);
      if (index >= 0) {
        order.splice(index, 1);
      } else {
        order.push(value);
      }
      renderFormatSelection(containerId);
      updateExamples(containerId);
      queueSave({ [STORAGE_KEYS[containerId]]: [...order] });
    });
  }
  function bindSwitch(id, storageKey) {
    const input = document.getElementById(id);
    if (!input)
      return;
    input.addEventListener("change", () => queueSave({ [storageKey]: input.checked }));
  }
  function bindTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((btn) => {
          btn.classList.remove("active");
          btn.setAttribute("aria-selected", "false");
        });
        document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        const targetContent = document.getElementById(`${tab.dataset.tab}-tab`);
        if (targetContent) {
          targetContent.classList.add("active");
        }
      });
    });
  }
  async function loadLogs() {
    const platformEl = document.getElementById("logPlatform");
    if (!platformEl)
      return;
    const platform = platformEl.value;
    const { errorLogs = [] } = await Storage.getLocal("errorLogs");
    const filteredLogs = platform === "all" ? errorLogs : errorLogs.filter((log) => log.platform === platform);
    const logList = document.getElementById("logList");
    if (!logList)
      return;
    logList.replaceChildren();
    if (filteredLogs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = t("noLogs", [], "\u6682\u65E0\u9519\u8BEF\u65E5\u5FD7");
      logList.appendChild(empty);
      return;
    }
    filteredLogs.forEach((log) => {
      const item = document.createElement("div");
      item.className = "log-item";
      const header = document.createElement("div");
      header.className = "log-header";
      const platformSpan = document.createElement("span");
      platformSpan.textContent = log.platform || "-";
      const timeSpan = document.createElement("span");
      timeSpan.className = "log-time";
      timeSpan.textContent = log.timestamp ? new Date(log.timestamp).toLocaleString() : "";
      header.append(platformSpan, timeSpan);
      const action = document.createElement("div");
      action.className = "log-action";
      action.textContent = log.action || "";
      const error = document.createElement("div");
      error.className = "log-error";
      error.textContent = log.error || "";
      item.append(header, action, error);
      if (log.url) {
        const url = document.createElement("div");
        url.className = "log-url";
        url.textContent = log.url.length > 120 ? `${log.url.slice(0, 120)}\u2026` : log.url;
        url.title = log.url;
        item.appendChild(url);
      }
      logList.appendChild(item);
    });
  }
  async function exportLogs() {
    const { errorLogs = [] } = await Storage.getLocal("errorLogs");
    if (errorLogs.length === 0) {
      showToast(t("noLogsToExport", [], "\u6682\u65E0\u65E5\u5FD7\u53EF\u5BFC\u51FA"));
      return;
    }
    const content = JSON.stringify(errorLogs, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-logs-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("logsExportedToast", [], "\u65E5\u5FD7\u5DF2\u5BFC\u51FA"));
  }
  function bindReset() {
    const resetButton = document.getElementById("resetButton");
    if (!resetButton)
      return;
    resetButton.addEventListener("click", () => {
      state.orders.twitterFormat = [...DEFAULT_TWITTER_FORMATS];
      state.orders.pixivFormat = [...DEFAULT_PIXIV_FORMATS];
      renderFormatSelection("twitterFormat");
      renderFormatSelection("pixivFormat");
      updateExamples("twitterFormat");
      updateExamples("pixivFormat");
      const switches = { twitterSwitch: true, pixivSwitch: true, notificationSwitch: true };
      for (const [id, value] of Object.entries(switches)) {
        const input = document.getElementById(id);
        if (input)
          input.checked = value;
      }
      queueSave({
        twitterFilenameFormat: [...DEFAULT_TWITTER_FORMATS],
        pixivFilenameFormat: [...DEFAULT_PIXIV_FORMATS],
        twitterSwitchActive: true,
        pixivSwitchActive: true,
        notificationsEnabled: true
      });
    });
  }
  async function init() {
    applyI18n();
    const versionLabel = document.getElementById("versionLabel");
    if (versionLabel && typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
      versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
    }
    const result = await Storage.getSync([
      "twitterFilenameFormat",
      "pixivFilenameFormat",
      "twitterSwitchActive",
      "pixivSwitchActive",
      "notificationsEnabled"
    ]);
    state.orders.twitterFormat = Array.isArray(result.twitterFilenameFormat) && result.twitterFilenameFormat.length > 0 ? [...result.twitterFilenameFormat] : [...DEFAULT_TWITTER_FORMATS];
    state.orders.pixivFormat = Array.isArray(result.pixivFilenameFormat) && result.pixivFilenameFormat.length > 0 ? [...result.pixivFilenameFormat] : [...DEFAULT_PIXIV_FORMATS];
    renderFormatSelection("twitterFormat");
    renderFormatSelection("pixivFormat");
    updateExamples("twitterFormat");
    updateExamples("pixivFormat");
    const twitterSwitch = document.getElementById("twitterSwitch");
    if (twitterSwitch) {
      twitterSwitch.checked = typeof result.twitterSwitchActive === "undefined" ? true : result.twitterSwitchActive;
    }
    const pixivSwitch = document.getElementById("pixivSwitch");
    if (pixivSwitch) {
      pixivSwitch.checked = typeof result.pixivSwitchActive === "undefined" ? true : result.pixivSwitchActive;
    }
    const notificationSwitch = document.getElementById("notificationSwitch");
    if (notificationSwitch) {
      notificationSwitch.checked = typeof result.notificationsEnabled === "undefined" ? true : result.notificationsEnabled;
    }
    bindFormatSelection("twitterFormat");
    bindFormatSelection("pixivFormat");
    bindSwitch("twitterSwitch", "twitterSwitchActive");
    bindSwitch("pixivSwitch", "pixivSwitchActive");
    bindSwitch("notificationSwitch", "notificationsEnabled");
    bindReset();
    bindTabs();
    const logPlatform = document.getElementById("logPlatform");
    if (logPlatform)
      logPlatform.addEventListener("change", loadLogs);
    const clearLogs = document.getElementById("clearLogs");
    if (clearLogs) {
      clearLogs.addEventListener("click", async () => {
        if (!confirm(t("clearLogsConfirm", [], "\u786E\u5B9A\u6E05\u7A7A\u6240\u6709\u65E5\u5FD7\uFF1F")))
          return;
        await Storage.setLocal({ errorLogs: [] });
        loadLogs();
      });
    }
    const exportLogsBtn = document.getElementById("exportLogs");
    if (exportLogsBtn)
      exportLogsBtn.addEventListener("click", exportLogs);
    await loadLogs();
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
//# sourceMappingURL=popup.js.map
