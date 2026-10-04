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
    pixivFilenameFormat: ["authorName", "illustId"],
    pixivProxies: [],
    activeProxyId: null,
    autoSwitchProxy: true,
    roundRobinProxy: false,
    proxyTestUrl: "https://www.pixiv.net/artworks/119870733"
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
    async getProxySettings() {
      const result = await Storage.getSync([
        "pixivProxies",
        "activeProxyId",
        "autoSwitchProxy",
        "roundRobinProxy",
        "proxyTestUrl"
      ]);
      return {
        pixivProxies: result.pixivProxies || DEFAULTS.pixivProxies,
        activeProxyId: result.activeProxyId || DEFAULTS.activeProxyId,
        autoSwitchProxy: typeof result.autoSwitchProxy === "undefined" ? DEFAULTS.autoSwitchProxy : result.autoSwitchProxy,
        roundRobinProxy: typeof result.roundRobinProxy === "undefined" ? DEFAULTS.roundRobinProxy : result.roundRobinProxy,
        proxyTestUrl: result.proxyTestUrl || DEFAULTS.proxyTestUrl
      };
    }
    async setSettings(settings) {
      await Storage.setSync(settings);
    }
  };

  // src/core/downloader.js
  var Downloader = class {
    constructor({ dedupWindowMs = 5e3 } = {}) {
      this.dedupWindowMs = dedupWindowMs;
      this.recentDownloads = /* @__PURE__ */ new Map();
    }
    isDuplicate(url) {
      if (!url || this.dedupWindowMs <= 0)
        return false;
      const now = Date.now();
      const last = this.recentDownloads.get(url);
      if (last && now - last < this.dedupWindowMs) {
        return true;
      }
      this.recentDownloads.set(url, now);
      if (this.recentDownloads.size > 200) {
        for (const [key, timestamp] of this.recentDownloads.entries()) {
          if (now - timestamp >= this.dedupWindowMs) {
            this.recentDownloads.delete(key);
          }
        }
      }
      return false;
    }
    async downloadImage({ url, metadata }) {
      if (this.isDuplicate(url)) {
        return { success: true, deduplicated: true };
      }
      return this.sendMessage("downloadImage", { url, ...metadata });
    }
    async downloadVideo({ url, metadata }) {
      if (this.isDuplicate(url)) {
        return { success: true, deduplicated: true };
      }
      return this.sendMessage("downloadVideo", { url, ...metadata });
    }
    sendMessage(action, payload) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...payload }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve(response);
            return;
          }
          reject(new Error(response?.error?.message || response?.error || "\u65E0\u54CD\u5E94"));
        });
      });
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

  // src/core/proxy-manager.js
  var ProxyManager = class {
    constructor() {
      this.proxyDomain = "pixiv.zhongrui.app";
    }
    async load() {
      return Promise.resolve();
    }
    /**
     * 获取代理域名
     * @returns {string} 代理域名
     */
    getProxyDomain() {
      return this.proxyDomain;
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

  // src/platforms/base-platform.js
  var BasePlatform = class {
    constructor({ name, downloader, retryManager } = {}) {
      this.name = name;
      this.downloader = downloader;
      this.retryManager = retryManager;
    }
    detectAction() {
      throw new Error("detectAction() must be implemented");
    }
    async handleAction() {
      throw new Error("handleAction() must be implemented");
    }
    validateData() {
      return true;
    }
    async handleError(error, context) {
      await ErrorLogger.log({
        platform: this.name,
        action: context?.action || "unknown",
        url: context?.url || "",
        error: error?.message || String(error),
        retryCount: context?.retryCount || 0,
        success: false
      });
    }
  };

  // src/platforms/twitter/twitter-detector.js
  function findTweetContainer(eventTarget) {
    const likeButton = eventTarget.closest('[data-testid="like"]');
    if (!likeButton)
      return null;
    return likeButton.closest('article[data-testid="tweet"]') || likeButton.closest('[data-testid="cellInnerDiv"]');
  }
  function extractTweetMetadata(container) {
    let authorId = "unknown_author";
    const usernameSpans = container.querySelectorAll('[data-testid="User-Name"] span');
    usernameSpans.forEach((span) => {
      const textContent = span.textContent.trim();
      if (textContent.includes("@")) {
        authorId = textContent;
      }
    });
    const tweetId = container.querySelector('a[href*="/status/"]')?.href.match(/status\/(\d+)/)?.[1] || "unknown_tweet_id";
    let tweetTime = "unknown_time";
    const timeElement = container.querySelector("time");
    if (timeElement) {
      const datetime = timeElement.getAttribute("datetime");
      if (datetime) {
        const date = new Date(datetime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        tweetTime = `${year}${month}${day}`;
      }
    }
    return { authorId, tweetId, tweetTime };
  }
  function extractTweetImages(container) {
    const images = Array.from(container.querySelectorAll("img")).filter((img) => img.src && img.src.includes("pbs.twimg.com/media/"));
    const seen = /* @__PURE__ */ new Set();
    return images.filter((img) => {
      try {
        const url = new URL(img.src);
        const key = url.pathname;
        if (seen.has(key))
          return false;
        seen.add(key);
        return true;
      } catch {
        return true;
      }
    });
  }
  function extractTweetVideoComponents(container) {
    const components = new Set(
      Array.from(container.querySelectorAll('[data-testid="videoComponent"]'))
    );
    for (const video of container.querySelectorAll("video")) {
      components.add(video.closest('[data-testid="videoComponent"]') || video);
    }
    return Array.from(components);
  }

  // src/platforms/twitter/twitter-api.js
  function getCsrfToken() {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "ct0") {
        return decodeURIComponent(value);
      }
    }
    return null;
  }
  function findVideoUrlInResponse(data, tweetId, parsePath) {
    try {
      let media = null;
      if (parsePath === "data.tweetResult.result") {
        const result = data?.data?.tweetResult?.result;
        if (!result) {
          return null;
        }
        const legacy = result.legacy || result.tweet?.legacy;
        media = legacy?.extended_entities?.media;
      } else {
        const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions;
        if (!instructions || !Array.isArray(instructions)) {
          return null;
        }
        const addEntriesInstruction = instructions.find((i) => i.type === "TimelineAddEntries");
        if (!addEntriesInstruction || !Array.isArray(addEntriesInstruction.entries)) {
          return null;
        }
        const targetEntry = addEntriesInstruction.entries.find((e) => e.entryId && e.entryId.includes(tweetId));
        if (!targetEntry) {
          return null;
        }
        const tweetResults = targetEntry.content?.itemContent?.tweet_results;
        if (!tweetResults) {
          return null;
        }
        const legacy = tweetResults.result?.tweet?.legacy || tweetResults.result?.legacy;
        media = legacy?.extended_entities?.media;
      }
      if (!media || !Array.isArray(media)) {
        return null;
      }
      for (const mediaItem of media) {
        if (mediaItem.type === "video" || mediaItem.type === "animated_gif") {
          const videoInfo = mediaItem.video_info;
          if (videoInfo && videoInfo.variants) {
            const mp4Variants = videoInfo.variants.filter((v) => v.content_type === "video/mp4");
            if (mp4Variants.length > 0) {
              mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
              return mp4Variants[0].url;
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error("\u89E3\u6790\u89C6\u9891URL\u5931\u8D25:", error);
      return null;
    }
  }
  async function callTwitterAPI(csrfToken, api, tweetId) {
    const url = new URL(`https://x.com/i/api/graphql/${api.QUERY_ID}/${api.QUERY_NAME}`);
    url.searchParams.append("variables", JSON.stringify(api.variables));
    url.searchParams.append("features", JSON.stringify(api.features));
    if (api.fieldToggles) {
      url.searchParams.append("fieldToggles", JSON.stringify(api.fieldToggles));
    }
    const response = await fetch(url.href, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        "x-twitter-active-user": "yes",
        "x-csrf-token": csrfToken,
        "User-Agent": navigator.userAgent
      }
    });
    if (!response.ok) {
      const error = new Error(`API request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    return findVideoUrlInResponse(data, tweetId, api.parsePath);
  }
  async function fetchVideoUrlFromTwitterAPI(tweetId) {
    try {
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error("\u65E0\u6CD5\u83B7\u53D6CSRF token");
      }
      const apis = [
        {
          QUERY_ID: "0hWvDhmW8YQ-S_ib3azIrw",
          QUERY_NAME: "TweetResultByRestId",
          variables: {
            tweetId,
            withCommunity: false,
            includePromotedContent: false,
            withVoice: false
          },
          features: {
            creator_subscriptions_tweet_preview_api_enabled: false,
            tweetypie_unmention_optimization_enabled: true,
            responsive_web_edit_tweet_api_enabled: true,
            graphql_is_translatable_rweb_tweet_is_translatable_enabled: false,
            view_counts_everywhere_api_enabled: false,
            longform_notetweets_consumption_enabled: true,
            responsive_web_twitter_article_tweet_consumption_enabled: false,
            tweet_awards_web_tipping_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: true,
            standardized_nudges_misinfo: false,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
            longform_notetweets_rich_text_read_enabled: false,
            longform_notetweets_inline_media_enabled: false,
            responsive_web_graphql_exclude_directive_enabled: true,
            verified_phone_label_enabled: false,
            responsive_web_media_download_video_enabled: false,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            responsive_web_graphql_timeline_navigation_enabled: false,
            responsive_web_enhance_cards_enabled: false
          },
          fieldToggles: {
            withArticleRichContentState: false,
            withAuxiliaryUserLabels: false
          },
          parsePath: "data.tweetResult.result"
        },
        {
          QUERY_ID: "_8aYOgEDz35BrBcBal1-_w",
          QUERY_NAME: "TweetDetail",
          variables: {
            focalTweetId: tweetId,
            rankingMode: "Relevance",
            includePromotedContent: false,
            withCommunity: false,
            withQuickPromoteEligibilityTweetFields: false,
            withBirdwatchNotes: false,
            withVoice: false
          },
          features: {
            rweb_video_screen_enabled: false,
            profile_label_improvements_pcf_label_in_post_enabled: true,
            rweb_tipjar_consumption_enabled: true,
            verified_phone_label_enabled: false,
            creator_subscriptions_tweet_preview_api_enabled: true,
            responsive_web_graphql_timeline_navigation_enabled: true,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            premium_content_api_read_enabled: false,
            communities_web_enable_tweet_community_results_fetch: true,
            c9s_tweet_anatomy_moderator_badge_enabled: true,
            responsive_web_grok_analyze_button_fetch_trends_enabled: false,
            responsive_web_grok_analyze_post_followups_enabled: true,
            responsive_web_jetfuel_frame: false,
            responsive_web_grok_share_attachment_enabled: true,
            articles_preview_enabled: true,
            responsive_web_edit_tweet_api_enabled: true,
            graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
            view_counts_everywhere_api_enabled: true,
            longform_notetweets_consumption_enabled: true,
            responsive_web_twitter_article_tweet_consumption_enabled: true,
            tweet_awards_web_tipping_enabled: false,
            responsive_web_grok_show_grok_translated_post: false,
            responsive_web_grok_analysis_button_from_backend: false,
            creator_subscriptions_quote_tweet_preview_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: true,
            standardized_nudges_misinfo: true,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
            longform_notetweets_rich_text_read_enabled: true,
            longform_notetweets_inline_media_enabled: true,
            responsive_web_grok_image_annotation_enabled: true,
            responsive_web_enhance_cards_enabled: false
          },
          fieldToggles: {
            withArticleRichContentState: true,
            withArticlePlainText: false,
            withGrokAnalyze: false,
            withDisallowedReplyControls: false
          },
          parsePath: "threaded_conversation_with_injections_v2"
        }
      ];
      for (const api of apis) {
        try {
          const videoUrl = await callTwitterAPI(csrfToken, api, tweetId);
          if (videoUrl) {
            return videoUrl;
          }
        } catch (error) {
          console.log(`${api.QUERY_NAME} \u5931\u8D25:`, error.message);
        }
      }
      return null;
    } catch (error) {
      console.error("\u8C03\u7528Twitter API\u5931\u8D25:", error);
      return null;
    }
  }

  // src/platforms/twitter/twitter-platform.js
  var tweetVideoCache = /* @__PURE__ */ new Map();
  function cacheVideoData(videoData) {
    if (videoData && videoData.tweetId && typeof videoData.videoUrl === "string" && videoData.videoUrl.startsWith("https://video.twimg.com/")) {
      tweetVideoCache.set(videoData.tweetId, {
        videoUrl: videoData.videoUrl,
        resolution: videoData.resolution,
        timestamp: Date.now()
      });
    }
  }
  if (typeof window !== "undefined") {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.source !== "mh-inject")
        return;
      if (data.type === "mh:video-captured") {
        cacheVideoData(data.payload);
      } else if (data.type === "mh:video-snapshot") {
        (data.payload || []).forEach((item) => cacheVideoData(item));
      }
    });
  }
  var TwitterPlatform = class extends BasePlatform {
    constructor({ downloader, retryManager }) {
      super({ name: "twitter", downloader, retryManager });
      window.postMessage({ source: "mh-content", type: "mh:request-videos" }, "*");
    }
    detectAction(event) {
      return Boolean(findTweetContainer(event.target));
    }
    async handleAction(event) {
      const tweetContainer = findTweetContainer(event.target);
      if (!tweetContainer)
        return false;
      const { authorId, tweetId, tweetTime } = extractTweetMetadata(tweetContainer);
      const images = extractTweetImages(tweetContainer);
      for (let i = 0; i < images.length; i += 1) {
        const img = images[i];
        const imgUrl = new URL(img.src);
        imgUrl.searchParams.set("name", "orig");
        try {
          await this.downloadImage(imgUrl.toString(), {
            authorId,
            tweetId,
            tweetTime,
            pageIndex: i + 1,
            pageTotal: images.length
          });
        } catch (error) {
          await this.handleError(error, { action: "downloadImage", url: imgUrl.toString() });
        }
      }
      const videoComponents = extractTweetVideoComponents(tweetContainer);
      for (const videoComponent of videoComponents) {
        const video = videoComponent.tagName === "VIDEO" ? videoComponent : videoComponent.querySelector("video");
        if (!video)
          continue;
        const cachedVideo = this.getVideoUrlFromCache(tweetId);
        if (cachedVideo) {
          try {
            await this.downloadVideo(cachedVideo.videoUrl, {
              resolution: cachedVideo.resolution,
              authorId,
              tweetId,
              tweetTime
            });
          } catch (error) {
            await this.handleError(error, { action: "downloadVideo", url: cachedVideo.videoUrl });
          }
          continue;
        }
        const resolution = video.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : null;
        try {
          await this.attemptVideoDownload({ authorId, tweetId, tweetTime }, resolution, video);
        } catch (error) {
          await this.handleError(error, { action: "downloadVideo", url: video.poster || video.src || "" });
        }
      }
      return true;
    }
    getVideoUrlFromCache(tweetId) {
      const cached = tweetVideoCache.get(tweetId);
      if (!cached)
        return null;
      if (Date.now() - cached.timestamp < 36e5) {
        return cached;
      }
      tweetVideoCache.delete(tweetId);
      return null;
    }
    async downloadImage(url, metadata) {
      if (!this.retryManager) {
        await this.downloader.downloadImage({ url, metadata: { ...metadata, platform: "twitter" } });
        return;
      }
      await this.retryManager.retry(async () => {
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
        await this.downloader.downloadImage({ url, metadata: { ...metadata, platform: "twitter" } });
      }, {
        name: "Twitter\u56FE\u7247\u4E0B\u8F7D",
        onRetry: ({ attempt }) => {
          if (attempt === 1) {
            chrome.runtime.sendMessage({
              action: "notify",
              level: "warning",
              title: "\u4E0B\u8F7D\u91CD\u8BD5\u4E2D",
              message: "Twitter\u56FE\u7247\u6B63\u5728\u91CD\u8BD5..."
            });
          }
        }
      });
    }
    async downloadVideo(url, metadata) {
      await this.downloader.downloadVideo({
        url,
        metadata: { ...metadata, platform: "twitter" }
      });
    }
    async attemptVideoDownload(metadata, resolution = null, videoEl = null) {
      const cachedVideo = this.getVideoUrlFromCache(metadata.tweetId);
      if (cachedVideo) {
        await this.downloadVideo(cachedVideo.videoUrl, {
          resolution: cachedVideo.resolution,
          ...metadata
        });
        return;
      }
      try {
        const videoUrl = await fetchVideoUrlFromTwitterAPI(metadata.tweetId);
        if (videoUrl) {
          await this.downloadVideo(videoUrl, { resolution, ...metadata });
          return;
        }
      } catch (error) {
        console.log("Twitter API \u65B9\u6CD5\u5931\u8D25:", error.message);
      }
      const src = videoEl?.currentSrc || videoEl?.src || "";
      if (/^https?:/.test(src) && src.includes("video.twimg.com")) {
        await this.downloadVideo(src, { resolution, ...metadata });
      }
    }
  };

  // src/utils/pixiv-dom-cache.js
  var PixivDOMCache = class {
    constructor() {
      this.containerCache = /* @__PURE__ */ new WeakMap();
      this.buttonCache = /* @__PURE__ */ new WeakMap();
      this.lastUrl = window.location.href;
      this.stats = {
        cacheHits: 0,
        cacheMisses: 0,
        totalQueries: 0
      };
      this.setupUrlWatcher();
    }
    setupUrlWatcher() {
      if (this.urlObserver)
        return;
      this.urlObserver = new MutationObserver(() => {
        this.onUrlChange();
      });
      this.urlObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      window.addEventListener("popstate", () => this.onUrlChange());
    }
    onUrlChange() {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        this.lastUrl = currentUrl;
        this.resetStats();
      }
    }
    setContainer(button, container) {
      this.buttonCache.set(button, container);
      this.containerCache.set(container, {
        images: Array.from(container.querySelectorAll("img")),
        links: Array.from(container.querySelectorAll('a[href*="/artworks/"]')),
        userLinks: Array.from(container.querySelectorAll('a[href*="/users/"]')),
        timestamp: Date.now()
      });
    }
    getContainer(button) {
      this.stats.totalQueries += 1;
      const container = this.buttonCache.get(button) || null;
      if (!container) {
        this.stats.cacheMisses += 1;
        return null;
      }
      if (!document.body.contains(container)) {
        this.buttonCache.delete(button);
        this.stats.cacheMisses += 1;
        return null;
      }
      this.stats.cacheHits += 1;
      return container;
    }
    getContainerMetadata(container) {
      if (!container || !document.body.contains(container)) {
        if (container) {
          this.containerCache.delete(container);
        }
        return null;
      }
      return this.containerCache.get(container) || null;
    }
    clear() {
      this.containerCache = /* @__PURE__ */ new WeakMap();
      this.buttonCache = /* @__PURE__ */ new WeakMap();
      this.resetStats();
    }
    resetStats() {
      this.stats.cacheHits = 0;
      this.stats.cacheMisses = 0;
      this.stats.totalQueries = 0;
    }
    getStats() {
      const total = this.stats.cacheHits + this.stats.cacheMisses;
      return {
        ...this.stats,
        hitRate: total ? this.stats.cacheHits / total : 0
      };
    }
  };
  var pixivCache = new PixivDOMCache();

  // src/platforms/pixiv/pixiv-detector.js
  var BOOKMARK_HINTS = [
    // 日文
    "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u306B\u8FFD\u52A0",
    "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u6E08\u307F",
    "\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF\u89E3\u9664",
    // 中文
    "\u6536\u85CF",
    "\u5DF2\u6536\u85CF",
    "\u53D6\u6D88\u6536\u85CF",
    "\u6DFB\u52A0\u6536\u85CF",
    // 英文
    "bookmark",
    "Bookmark",
    "add bookmark",
    "remove bookmark",
    "Add to bookmarks"
  ];
  function matchesBookmarkHint(text) {
    if (!text)
      return false;
    const lower = String(text).toLowerCase();
    return BOOKMARK_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
  }
  function isBookmarkElement(el) {
    if (!el || el.nodeType !== 1)
      return false;
    if (matchesBookmarkHint(el.getAttribute?.("aria-label")))
      return true;
    if (matchesBookmarkHint(el.getAttribute?.("title")))
      return true;
    if (matchesBookmarkHint(el.getAttribute?.("data-ga4-label")))
      return true;
    const cls = el.className && typeof el.className === "string" ? el.className : "";
    if (/bookmark/i.test(cls))
      return true;
    return false;
  }
  function findPixivBookmarkButton(target) {
    let el = target;
    while (el && el !== document.body) {
      if (isBookmarkElement(el)) {
        if (el.tagName === "BUTTON" || el.getAttribute?.("role") === "button")
          return el;
        const inner = el.querySelector?.('button, [role="button"]');
        if (inner && isBookmarkElement(inner))
          return inner;
        return el;
      }
      el = el.parentElement;
    }
    let button = target.closest('[data-ga4-label="bookmark_button"]');
    if (button)
      return button;
    button = target.closest("button");
    if (button && isLikelyBookmarkButton(button))
      return button;
    return null;
  }
  function isLikelyBookmarkButton(button) {
    const buttonText = button.textContent.trim();
    const isFollowButton = buttonText.includes("\u5173\u6CE8") || buttonText.includes("\u30D5\u30A9\u30ED\u30FC") || buttonText.includes("follow");
    if (isFollowButton)
      return false;
    if (!button.querySelector("svg"))
      return false;
    return true;
  }
  function findArtworkContainer(bookmarkButton) {
    const cached = pixivCache.getContainer(bookmarkButton);
    if (cached) {
      return cached;
    }
    if (window.location.pathname.startsWith("/artworks/")) {
      return document.body;
    }
    let container;
    if (isRecommendationFeed(bookmarkButton)) {
      container = findRecommendationArtworkContainer(bookmarkButton);
    } else {
      container = findFollowingArtworkContainer(bookmarkButton);
    }
    if (container) {
      pixivCache.setContainer(bookmarkButton, container);
    }
    return container;
  }
  function isRecommendationFeed(bookmarkButton) {
    const workContentContainer = bookmarkButton.closest('[data-ga4-label="work_content"]');
    if (workContentContainer) {
      return true;
    }
    const container = bookmarkButton.closest("div");
    if (!container)
      return false;
    const hasRecommendationText = container.textContent.includes("\u5176\u4ED6\u4F5C\u54C1") || container.textContent.includes("\u7684\u5176\u4ED6\u4F5C\u54C1") || container.querySelector('[class*="recommend"], [class*="suggest"]');
    const bookmarkButtonsCount = container.querySelectorAll('button[data-ga4-label="bookmark_button"]').length;
    const hasMultipleBookmarks = bookmarkButtonsCount > 3;
    const mainImg = container.querySelector("img");
    const isLargeImage = mainImg && (mainImg.offsetWidth > 300 || mainImg.offsetHeight > 300);
    return Boolean(hasRecommendationText || hasMultipleBookmarks || isLargeImage);
  }
  function findFollowingArtworkContainer(bookmarkButton) {
    let container = bookmarkButton.closest("li");
    if (container && container.querySelector("img") && container.querySelector('a[href*="/artworks/"]')) {
      return container;
    }
    const scContainers = ['[class*="sc-"]', '[class*="gtm-"]'];
    for (const selector of scContainers) {
      container = bookmarkButton.closest(selector);
      if (container && container.querySelector("img") && container.querySelector('a[href*="/artworks/"]')) {
        return container;
      }
    }
    let current = bookmarkButton.parentElement;
    while (current && current !== document.body) {
      const hasImage = current.querySelector("img");
      const hasLink = current.querySelector('a[href*="/artworks/"]');
      if (hasImage && hasLink) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
  function findRecommendationArtworkContainer(bookmarkButton) {
    const allImages = Array.from(document.getElementsByTagName("img"));
    const allLinks = Array.from(document.querySelectorAll('a[href*="/artworks/"]'));
    const allButtons = Array.from(document.querySelectorAll('button[data-ga4-label="bookmark_button"]'));
    let current = bookmarkButton;
    let attempts = 0;
    while (current && current !== document.body && attempts < 8) {
      current = current.parentElement;
      attempts += 1;
      if (!current)
        break;
      const imageCount = countContained(allImages, current, 1);
      const linkCount = countContained(allLinks, current, 3);
      const buttonInfo = countButtons(allButtons, current, bookmarkButton, 2);
      if (imageCount > 0 && linkCount > 0 && buttonInfo.count === 1 && buttonInfo.matches) {
        return current;
      }
      const entityId = current.getAttribute("data-ga4-entity-id");
      if (entityId && entityId.startsWith("illust/")) {
        if (imageCount > 0 && linkCount > 0) {
          return current;
        }
      }
      if (imageCount > 0 && linkCount > 0 && linkCount <= 2) {
        return current;
      }
    }
    return findFollowingArtworkContainer(bookmarkButton);
  }
  function countContained(nodes, container, maxCount) {
    let count = 0;
    for (const node of nodes) {
      if (!container.contains(node))
        continue;
      count += 1;
      if (maxCount && count >= maxCount)
        break;
    }
    return count;
  }
  function countButtons(nodes, container, targetButton, maxCount) {
    let count = 0;
    let matches = false;
    for (const node of nodes) {
      if (!container.contains(node))
        continue;
      count += 1;
      if (node === targetButton || node.contains(targetButton)) {
        matches = true;
      }
      if (maxCount && count >= maxCount)
        break;
    }
    return { count, matches };
  }

  // src/platforms/pixiv/pixiv-api.js
  var META_URL = (id) => `https://www.pixiv.net/ajax/illust/${id}`;
  var PAGES_URL = (id) => `https://www.pixiv.net/ajax/illust/${id}/pages`;
  function asJson(response) {
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return response.json();
  }
  async function fetchAjaxBody(url, label) {
    const data = await asJson(await fetch(url));
    if (!data || data.error) {
      throw new Error(data?.message || `${label} \u8FD4\u56DE\u9519\u8BEF`);
    }
    return data.body;
  }
  async function fetchIllustMeta(illustId) {
    const body = await fetchAjaxBody(META_URL(illustId), `illust/${illustId}`);
    if (!body || !body.illustId) {
      throw new Error(`illust/${illustId} \u54CD\u5E94\u7F3A\u5C11 body`);
    }
    return {
      illustId: body.illustId,
      illustTitle: body.illustTitle || "",
      userId: body.userId,
      userName: body.userName,
      pageCount: body.pageCount,
      // 单图作品 body.urls.original 直接就是原图
      originalUrl: body.urls?.original || null,
      tags: Array.isArray(body.tags?.tags) ? body.tags.tags.map((t) => t.tag) : []
    };
  }
  async function fetchIllustPages(illustId) {
    const body = await fetchAjaxBody(PAGES_URL(illustId), `illust/${illustId}/pages`);
    if (!Array.isArray(body)) {
      throw new Error(`illust/${illustId}/pages \u8FD4\u56DE\u7ED3\u6784\u5F02\u5E38`);
    }
    return body.map((p) => ({
      width: p.width,
      height: p.height,
      urls: p.urls || {}
    }));
  }

  // src/platforms/pixiv/pixiv-platform.js
  var ILLUST_ID_RE = /\/artworks\/(\d+)/;
  var DEBUG = false;
  function extractIllustId(target, metadata) {
    const fromLink = metadata?.links?.[0]?.href.match(ILLUST_ID_RE)?.[1];
    if (fromLink)
      return fromLink;
    const fromTarget = target?.href?.match(ILLUST_ID_RE)?.[1];
    if (fromTarget)
      return fromTarget;
    const fromUrl = window.location.pathname.match(ILLUST_ID_RE)?.[1];
    if (fromUrl)
      return fromUrl;
    const anyLink = document.querySelector("a[href*=\u201D/artworks/\u201D]");
    if (anyLink) {
      const m = anyLink.href.match(ILLUST_ID_RE);
      if (m)
        return m[1];
    }
    return null;
  }
  var PixivPlatform = class extends BasePlatform {
    constructor({ downloader, retryManager, proxyManager }) {
      super({ name: "pixiv", downloader, retryManager });
      this.proxyManager = proxyManager || new ProxyManager();
    }
    detectAction(event) {
      return Boolean(findPixivBookmarkButton(event.target));
    }
    async handleAction(event) {
      const bookmarkButton = findPixivBookmarkButton(event.target);
      if (!bookmarkButton) {
        if (DEBUG)
          console.log("[Pixiv] detector miss", {
            target: event.target,
            targetTag: event.target?.tagName,
            targetAria: event.target?.getAttribute?.("aria-label"),
            targetClass: event.target?.className
          });
        return false;
      }
      if (DEBUG)
        console.log("[Pixiv] handleAction start", bookmarkButton);
      await this.proxyManager.load();
      const container = findArtworkContainer(bookmarkButton);
      const metadata = container ? pixivCache.getContainerMetadata(container) : null;
      const illustId = extractIllustId(bookmarkButton, metadata);
      if (DEBUG)
        console.log("[Pixiv] illustId =", illustId);
      if (!illustId) {
        await this.handleError(new Error("\u672A\u627E\u5230 illustId"), { action: "detectIllustId" });
        return false;
      }
      let meta;
      let pages;
      try {
        [meta, pages] = await Promise.all([
          fetchIllustMeta(illustId),
          fetchIllustPages(illustId).catch((err) => {
            if (DEBUG)
              console.log("[Pixiv] /pages failed, fallback to meta.originalUrl:", err.message);
            return null;
          })
        ]);
        if (!pages && meta?.originalUrl) {
          pages = [{ urls: { original: meta.originalUrl } }];
        }
        if (DEBUG)
          console.log("[Pixiv] api ok", { author: meta?.userName, pageCount: pages?.length });
      } catch (error) {
        if (DEBUG)
          console.log("[Pixiv] api failed:", error.message, error);
        await this.handleError(error, { action: "fetchIllustMeta", url: `illust/${illustId}` });
        return false;
      }
      if (!pages || pages.length === 0) {
        await this.handleError(new Error("\u4F5C\u54C1\u65E0\u53EF\u4E0B\u8F7D\u9875\u9762"), { action: "fetchIllustPages", url: `illust/${illustId}/pages` });
        return false;
      }
      const fileMeta = {
        authorId: String(meta.userId || "unknown_author"),
        authorName: meta.userName || "unknown_author_name",
        illustId: String(meta.illustId || illustId),
        pageTotal: pages.length
      };
      for (let i = 0; i < pages.length; i += 1) {
        const originalUrl = pages[i].urls?.original;
        if (!originalUrl)
          continue;
        try {
          await this.downloadWithFallback(originalUrl, {
            ...fileMeta,
            pageIndex: i + 1
          });
        } catch (error) {
          await this.handleError(error, { action: "downloadImage", url: originalUrl });
        }
      }
      return true;
    }
    // 图片下载走反代优先：i.pximg.net 有防盗链（校验 Referer），
    // content script 里对它的 HEAD 请求是跨域 fetch，必然被 CORS 拦截。
    // 反代（Cloudflare Worker）服务端带 Referer 转发并返回 CORS 头，是可靠路径。
    // 反代失败时才回退原图直连（chrome.downloads 的下载不受 CORS 限制）。
    async downloadWithFallback(originalUrl, metadata) {
      const tried = /* @__PURE__ */ new Set();
      const proxyDomain = this.proxyManager.getProxyDomain();
      const candidates = proxyDomain && proxyDomain !== "YOUR_PROXY_DOMAIN_HERE" ? [this.replaceDomain(originalUrl, proxyDomain), originalUrl] : [originalUrl];
      let lastError;
      for (const url of candidates) {
        if (tried.has(url))
          continue;
        tried.add(url);
        try {
          await this.downloadImage(url, metadata);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("\u6240\u6709\u4E0B\u8F7D\u6E90\u5747\u5931\u8D25");
    }
    replaceDomain(url, domain) {
      const parsed = new URL(url);
      parsed.hostname = domain;
      return parsed.toString();
    }
    async downloadImage(url, metadata) {
      const attemptDownload = async (imageUrl) => {
        const response = await fetch(imageUrl, { method: "HEAD" });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
        await this.downloader.downloadImage({
          url: imageUrl,
          metadata: { ...metadata, platform: "pixiv" }
        });
      };
      if (!this.retryManager) {
        await attemptDownload(url);
        return;
      }
      await this.retryManager.retry(() => attemptDownload(url), {
        name: "Pixiv\u56FE\u7247\u4E0B\u8F7D",
        onRetry: ({ attempt }) => {
          if (attempt === 1) {
            chrome.runtime.sendMessage({
              action: "notify",
              level: "warning",
              title: "\u4E0B\u8F7D\u91CD\u8BD5\u4E2D",
              message: "Pixiv\u56FE\u7247\u6B63\u5728\u91CD\u8BD5..."
            });
          }
        }
      });
    }
  };

  // src/content.js
  var ContentScript = class {
    constructor() {
      this.platforms = /* @__PURE__ */ new Map();
      this.config = new ConfigManager();
      this.downloader = new Downloader();
      this.retryManager = new RetryManager();
      this.proxyManager = new ProxyManager();
      this.handleClick = this.handleClick.bind(this);
    }
    async init() {
      const switches = await this.config.getSwitches();
      this.updatePlatforms(switches);
      document.addEventListener("click", this.handleClick, true);
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync")
          return;
        if (changes.twitterSwitchActive || changes.pixivSwitchActive) {
          const twitterSwitchActive = changes.twitterSwitchActive ? changes.twitterSwitchActive.newValue : this.platforms.has("twitter");
          const pixivSwitchActive = changes.pixivSwitchActive ? changes.pixivSwitchActive.newValue : this.platforms.has("pixiv");
          this.updatePlatforms({ twitterSwitchActive, pixivSwitchActive });
        }
      });
    }
    updatePlatforms({ twitterSwitchActive, pixivSwitchActive }) {
      if (twitterSwitchActive) {
        if (!this.platforms.has("twitter")) {
          this.platforms.set("twitter", new TwitterPlatform({
            downloader: this.downloader,
            retryManager: this.retryManager
          }));
        }
      } else {
        this.platforms.delete("twitter");
      }
      if (pixivSwitchActive) {
        if (!this.platforms.has("pixiv")) {
          this.platforms.set("pixiv", new PixivPlatform({
            downloader: this.downloader,
            retryManager: this.retryManager,
            proxyManager: this.proxyManager
          }));
        }
      } else {
        this.platforms.delete("pixiv");
      }
    }
    async handleClick(event) {
      for (const platform of this.platforms.values()) {
        if (!platform.detectAction(event))
          continue;
        try {
          await platform.handleAction(event);
        } catch (error) {
          await platform.handleError(error, { action: "handleAction" });
        }
        break;
      }
    }
  };
  new ContentScript().init();
})();
//# sourceMappingURL=content.js.map
