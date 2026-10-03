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

  // src/popup.js
  var DEFAULT_TWITTER_FORMATS = ["account", "tweetId"];
  var DEFAULT_PIXIV_FORMATS = ["authorName", "illustId"];
  function t(key) {
    if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg)
        return msg;
    }
    return "";
  }
  function getCurrentLocale() {
    const lang = typeof chrome !== "undefined" && chrome.i18n?.getUILanguage?.() || typeof navigator !== "undefined" && (navigator.language || navigator.userLanguage) || "en";
    if (lang.startsWith("ja"))
      return "ja";
    if (lang === "zh-TW" || lang === "zh_TW" || lang.startsWith("zh-Hant"))
      return "zh_TW";
    if (lang.startsWith("zh"))
      return "zh_CN";
    if (lang.startsWith("de"))
      return "de";
    if (lang.startsWith("ko"))
      return "ko";
    if (lang.startsWith("ru"))
      return "ru";
    if (lang.startsWith("cs"))
      return "cs";
    return "en";
  }
  function applyI18n() {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
      const key = element.getAttribute("data-i18n");
      const msg = t(key);
      if (msg) {
        element.textContent = msg;
      }
    });
    const titleElement = document.querySelector("title[data-i18n]");
    if (titleElement) {
      const key = titleElement.getAttribute("data-i18n");
      const msg = t(key);
      if (msg) {
        document.title = msg;
      }
    }
  }
  var EXAMPLE_TEXTS = {
    "en": {
      "account": "exampleUser_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "exampleAuthor_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    },
    "ja": {
      "account": "\u30B5\u30F3\u30D7\u30EB\u30E6\u30FC\u30B6\u30FC_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "\u30B5\u30F3\u30D7\u30EB\u4F5C\u8005_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    },
    "zh_CN": {
      "account": "\u793A\u4F8B\u7528\u6237_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "\u793A\u4F8B\u4F5C\u8005_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    },
    "zh_TW": {
      "account": "\u7BC4\u4F8B\u4F7F\u7528\u8005_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "\u7BC4\u4F8B\u4F5C\u8005_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    },
    "de": {
      "account": "BeispielBenutzer_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "BeispielAutor_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    },
    "ko": {
      "account": "\uC608\uC2DC\uC0AC\uC6A9\uC790_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "\uC608\uC2DC\uC791\uAC00_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    },
    "ru": {
      "account": "\u041F\u0440\u0438\u043C\u0435\u0440\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "\u041F\u0440\u0438\u043C\u0435\u0440\u0410\u0432\u0442\u043E\u0440\u0430_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    },
    "cs": {
      "account": "P\u0159\xEDkladU\u017Eivatel_",
      "tweetId": "88669977_",
      "tweetTime": "20230810_",
      "authorName": "P\u0159\xEDkladAutor_",
      "authorId": "12345_",
      "illustId": "88669977_",
      "downloadDate": "20230811_"
    }
  };
  function getSelectedFormats(containerId) {
    const container = document.getElementById(containerId);
    if (!container)
      return [];
    const selectedOptions = container.querySelectorAll(".format-option.selected");
    return Array.from(selectedOptions).map((option) => option.getAttribute("data-value"));
  }
  function updateExample(containerId, exampleId) {
    const formats = getSelectedFormats(containerId);
    const locale = getCurrentLocale();
    const texts = EXAMPLE_TEXTS[locale] || EXAMPLE_TEXTS["en"];
    let exampleText = "";
    formats.forEach((format) => {
      if (texts[format]) {
        exampleText += texts[format];
      }
    });
    const targetEl = document.getElementById(exampleId);
    if (!targetEl)
      return;
    if (exampleId === "twitterVideoExample") {
      exampleText = exampleText ? exampleText.slice(0, -1) + "_1920x1080.mp4" : "1920x1080.mp4";
    } else {
      exampleText = exampleText ? exampleText.slice(0, -1) + ".jpg" : "example.jpg";
    }
    targetEl.textContent = exampleText;
  }
  function toggleSelection(containerId, exampleId, videoExampleId = null) {
    const container = document.getElementById(containerId);
    if (!container)
      return;
    container.addEventListener("click", (event) => {
      const option = event.target.closest(".format-option");
      if (option) {
        option.classList.toggle("selected");
        updateExample(containerId, exampleId);
        if (videoExampleId) {
          updateExample(containerId, videoExampleId);
        }
      }
    });
  }
  function showSuccessMessage() {
    const successMessage = document.getElementById("successMessage");
    if (!successMessage)
      return;
    successMessage.style.display = "flex";
    setTimeout(() => {
      successMessage.style.display = "none";
    }, 2e3);
  }
  function initSelection(containerId, storedFormats) {
    const container = document.getElementById(containerId);
    if (!container)
      return;
    storedFormats.forEach((format) => {
      const option = container.querySelector(`[data-value="${format}"]`);
      if (option) {
        option.classList.add("selected");
      }
    });
    if (containerId === "twitterFormat") {
      updateExample(containerId, "twitterExample");
      updateExample(containerId, "twitterVideoExample");
    } else {
      const exampleId = containerId === "pixivFormat" ? "pixivExample" : "twitterExample";
      updateExample(containerId, exampleId);
    }
  }
  function bindTabs() {
    const tabs = document.querySelectorAll(".tab");
    const contents = document.querySelectorAll(".tab-content");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((btn) => btn.classList.remove("active"));
        contents.forEach((content) => content.classList.remove("active"));
        tab.classList.add("active");
        const targetId = `${tab.dataset.tab}-tab`;
        const targetContent = document.getElementById(targetId);
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
    logList.innerHTML = "";
    if (filteredLogs.length === 0) {
      const emptyMsg = t("noLogs") || "\u6682\u65E0\u9519\u8BEF\u65E5\u5FD7";
      logList.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
      return;
    }
    filteredLogs.forEach((log) => {
      const item = document.createElement("div");
      item.className = "log-item";
      item.innerHTML = `
      <div class="log-header">
        <span class="log-platform">${log.platform}</span>
        <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
      </div>
      <div class="log-action">${log.action}</div>
      <div class="log-error">${log.error}</div>
      ${log.url ? `<div class="log-url">${log.url.substring(0, 50)}...</div>` : ""}
    `;
      logList.appendChild(item);
    });
  }
  async function exportLogs() {
    const { errorLogs = [] } = await Storage.getLocal("errorLogs");
    if (errorLogs.length === 0) {
      alert(t("noLogsToExport") || "\u6682\u65E0\u65E5\u5FD7\u53EF\u5BFC\u51FA");
      return;
    }
    const content = errorLogs.map((log) => JSON.stringify(log, null, 2)).join("\n");
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-logs-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  var saveButton = document.getElementById("saveButton");
  if (saveButton) {
    saveButton.addEventListener("click", async () => {
      const twitterFormats = getSelectedFormats("twitterFormat");
      const pixivFormats = getSelectedFormats("pixivFormat");
      const twitterSwitchState = document.getElementById("twitterSwitch")?.checked ?? true;
      const pixivSwitchState = document.getElementById("pixivSwitch")?.checked ?? true;
      const notificationsEnabled = document.getElementById("notificationSwitch")?.checked ?? true;
      await Storage.setSync({
        twitterFilenameFormat: twitterFormats,
        pixivFilenameFormat: pixivFormats,
        twitterSwitchActive: twitterSwitchState,
        pixivSwitchActive: pixivSwitchState,
        notificationsEnabled
      });
      showSuccessMessage();
    });
  }
  var logPlatform = document.getElementById("logPlatform");
  if (logPlatform)
    logPlatform.addEventListener("change", loadLogs);
  var clearLogs = document.getElementById("clearLogs");
  if (clearLogs) {
    clearLogs.addEventListener("click", async () => {
      await Storage.setLocal({ errorLogs: [] });
      loadLogs();
    });
  }
  var exportLogsBtn = document.getElementById("exportLogs");
  if (exportLogsBtn)
    exportLogsBtn.addEventListener("click", exportLogs);
  async function init() {
    applyI18n();
    const result = await Storage.getSync([
      "twitterFilenameFormat",
      "pixivFilenameFormat",
      "twitterSwitchActive",
      "pixivSwitchActive",
      "notificationsEnabled"
    ]);
    const twitterFormats = result.twitterFilenameFormat || DEFAULT_TWITTER_FORMATS;
    const pixivFormats = result.pixivFilenameFormat || DEFAULT_PIXIV_FORMATS;
    const twitterSwitch = typeof result.twitterSwitchActive === "undefined" ? true : result.twitterSwitchActive;
    const pixivSwitch = typeof result.pixivSwitchActive === "undefined" ? true : result.pixivSwitchActive;
    const notificationsEnabled = typeof result.notificationsEnabled === "undefined" ? true : result.notificationsEnabled;
    initSelection("twitterFormat", twitterFormats);
    initSelection("pixivFormat", pixivFormats);
    toggleSelection("twitterFormat", "twitterExample", "twitterVideoExample");
    toggleSelection("pixivFormat", "pixivExample");
    const twSwitch = document.getElementById("twitterSwitch");
    if (twSwitch)
      twSwitch.checked = twitterSwitch;
    const pxSwitch = document.getElementById("pixivSwitch");
    if (pxSwitch)
      pxSwitch.checked = pixivSwitch;
    const notifSwitch = document.getElementById("notificationSwitch");
    if (notifSwitch)
      notifSwitch.checked = notificationsEnabled;
    bindTabs();
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
