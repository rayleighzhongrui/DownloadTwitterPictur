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
    async downloadImage({ url, metadata }) {
      return this.sendMessage("downloadImage", { url, ...metadata });
    }
    async downloadVideo({ url, metadata }) {
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

  // src/utils/error-logger.js
  var LOG_KEY = "errorLogs";
  var MAX_LOGS = 100;
  var ErrorLogger = class {
    static async log(entry) {
      const { errorLogs = [] } = await Storage.getLocal(LOG_KEY);
      const next = [
        {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
    return likeButton.closest('[data-testid="cellInnerDiv"]');
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
    return Array.from(container.querySelectorAll("img")).filter((img) => img.src && img.src.includes("pbs.twimg.com/media/"));
  }
  function extractTweetVideoComponents(container) {
    return Array.from(container.querySelectorAll('[data-testid="videoComponent"]'));
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
  var TwitterPlatform = class extends BasePlatform {
    constructor({ downloader, retryManager }) {
      super({ name: "twitter", downloader, retryManager });
      this.tweetVideoCache = /* @__PURE__ */ new Map();
      document.addEventListener("mh:video-captured", (event) => {
        const videoData = event.detail;
        if (videoData && videoData.tweetId && videoData.videoUrl) {
          this.tweetVideoCache.set(videoData.tweetId, {
            videoUrl: videoData.videoUrl,
            resolution: videoData.resolution,
            timestamp: Date.now()
          });
        }
      });
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
      for (const img of images) {
        const imgUrl = new URL(img.src);
        imgUrl.searchParams.set("name", "orig");
        try {
          await this.downloadImage(imgUrl.toString(), { authorId, tweetId, tweetTime });
        } catch (error) {
          await this.handleError(error, { action: "downloadImage", url: imgUrl.toString() });
        }
      }
      const videoComponents = extractTweetVideoComponents(tweetContainer);
      for (const videoComponent of videoComponents) {
        const video = videoComponent.querySelector("video");
        if (!video || !video.poster)
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
        const posterMatch = video.poster.match(/amplify_video_thumb\/(\d+)\//);
        if (!posterMatch)
          continue;
        const videoId = posterMatch[1];
        const resolution = `${video.videoWidth}x${video.videoHeight}`;
        try {
          await this.attemptVideoDownload(videoId, resolution, { authorId, tweetId, tweetTime });
        } catch (error) {
          await this.handleError(error, { action: "downloadVideo", url: video.poster });
        }
      }
      return true;
    }
    getVideoUrlFromCache(tweetId) {
      const cached = this.tweetVideoCache.get(tweetId);
      if (!cached)
        return null;
      if (Date.now() - cached.timestamp < 36e5) {
        return cached;
      }
      this.tweetVideoCache.delete(tweetId);
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
    async attemptVideoDownload(videoId, resolution, metadata) {
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
        console.log("Twitter API\u65B9\u6CD5\u5931\u8D25:", error.message);
      }
      const resources = performance.getEntriesByType("resource");
      for (const resource of resources) {
        if (resource.name.includes("video.twimg.com") && resource.name.includes("amplify_video") && resource.name.includes(videoId) && resource.name.includes(".mp4") && !resource.name.includes(".m4s")) {
          await this.downloadVideo(resource.name, { resolution, ...metadata });
          return;
        }
      }
      this.setupNetworkListener(videoId, resolution, metadata);
    }
    setupNetworkListener(videoId, resolution, metadata) {
      let captured = false;
      const timeout = 5e3;
      const originalFetch = window.fetch;
      window.fetch = (...args) => {
        const url = args[0];
        if (typeof url === "string" && url.includes("video.twimg.com") && url.includes(videoId)) {
          if (url.includes(".m3u8") && !captured) {
            originalFetch.call(window, url).then((response) => response.text()).then((content) => {
              if (captured)
                return;
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i += 1) {
                const line = lines[i].trim();
                if (line.includes("RESOLUTION")) {
                  const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                  const nextLine = lines[i + 1]?.trim();
                  if (resMatch && nextLine && nextLine.includes("avc1")) {
                    const subUrl = nextLine.startsWith("http") ? nextLine : `https://video.twimg.com${nextLine}`;
                    originalFetch.call(window, subUrl).then((r) => r.text()).then((subContent) => {
                      if (captured)
                        return;
                      const subLines = subContent.split("\n");
                      for (const subLine of subLines) {
                        if (subLine.includes("#EXT-X-MAP")) {
                          const uriMatch = subLine.match(/URI="([^"]+)"/);
                          if (uriMatch) {
                            captured = true;
                            window.fetch = originalFetch;
                            const mp4Url = uriMatch[1].startsWith("http") ? uriMatch[1] : `https://video.twimg.com${uriMatch[1]}`;
                            this.downloadVideo(mp4Url, { resolution: resMatch[1], ...metadata }).catch((error) => this.handleError(error, { action: "downloadVideo", url: mp4Url }));
                            return;
                          }
                        }
                      }
                    }).catch(() => {
                    });
                    break;
                  }
                }
              }
            }).catch(() => {
            });
          }
          if (url.includes(".mp4") && url.includes("/vid/") && !url.includes(".m4s") && !captured) {
            captured = true;
            window.fetch = originalFetch;
            this.downloadVideo(url, { resolution, ...metadata }).catch((error) => this.handleError(error, { action: "downloadVideo", url }));
          }
        }
        return originalFetch.apply(window, args);
      };
      setTimeout(() => {
        if (!captured) {
          window.fetch = originalFetch;
          this.tryFetchTweetPage(videoId, resolution, metadata);
        }
      }, timeout);
    }
    async tryFetchTweetPage(videoId, resolution, metadata) {
      try {
        const scripts = document.querySelectorAll("script");
        for (const script of scripts) {
          const text = script.textContent;
          if (text && text.includes("video_url") && text.includes(videoId)) {
            const matches = text.match(new RegExp(`https://video\\.twimg\\.com/amplify_video/${videoId}/[^"]+\\.mp4`, "g"));
            if (matches && matches.length > 0) {
              await this.downloadVideo(matches[0], { resolution, ...metadata });
              return;
            }
          }
        }
      } catch (error) {
        console.log("\u4ECE\u9875\u9762\u83B7\u53D6\u89C6\u9891\u4FE1\u606F\u5931\u8D25:", error.message);
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
  function findPixivBookmarkButton(target) {
    let button = target.closest('[class*="bookmark"]');
    if (button)
      return button;
    button = target.closest('[data-ga4-label="bookmark_button"]');
    if (button)
      return button;
    button = target.closest("button");
    if (button && isLikelyBookmarkButton(button)) {
      return button;
    }
    return null;
  }
  function isLikelyBookmarkButton(button) {
    const container = button.closest('li, [class*="sc-"], div');
    if (!container)
      return false;
    const hasImage = container.querySelector("img");
    const hasArtworkLink = container.querySelector('a[href*="/artworks/"], a[href*="/users/"]');
    const hasIcon = button.querySelector("svg, img");
    const buttonText = button.textContent.trim();
    const isFollowButton = buttonText.includes("\u5173\u6CE8") || buttonText.includes("\u30D5\u30A9\u30ED\u30FC") || buttonText.includes("follow");
    return hasImage && hasArtworkLink && hasIcon && !isFollowButton;
  }
  function findArtworkContainer(bookmarkButton) {
    const cached = pixivCache.getContainer(bookmarkButton);
    if (cached) {
      return cached;
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
  function buildOriginalImageUrl(imgSrc, proxyDomain, illustId) {
    const standard = imgSrc.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_/);
    if (standard) {
      const [, year, month, day, hour, minute, second, matchedIllustId] = standard;
      const finalIllustId = illustId && illustId !== "unknown_id" ? illustId : matchedIllustId;
      return {
        illustId: finalIllustId,
        url: `https://${proxyDomain}/img-original/img/${year}/${month}/${day}/${hour}/${minute}/${second}/${finalIllustId}_p0.png`
      };
    }
    const simple = imgSrc.match(/img\/(\d{4})\/(\d{2})\/(\d{2})\/(\d+)_/);
    if (simple) {
      const [, year, month, day, matchedIllustId] = simple;
      const finalIllustId = illustId && illustId !== "unknown_id" ? illustId : matchedIllustId;
      return {
        illustId: finalIllustId,
        url: `https://${proxyDomain}/img-original/img/${year}/${month}/${day}/00/00/00/${finalIllustId}_p0.png`
      };
    }
    return null;
  }

  // src/core/proxy-manager.js
  var ProxyManager = class {
    constructor() {
      this.proxyDomain = "YOUR_PROXY_DOMAIN_HERE";
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

  // src/platforms/pixiv/pixiv-platform.js
  var PixivPlatform = class extends BasePlatform {
    constructor({ downloader, retryManager }) {
      super({ name: "pixiv", downloader, retryManager });
      this.proxyManager = new ProxyManager();
    }
    detectAction(event) {
      return Boolean(findPixivBookmarkButton(event.target));
    }
    async handleAction(event) {
      const bookmarkButton = findPixivBookmarkButton(event.target);
      if (!bookmarkButton)
        return false;
      await this.proxyManager.load();
      const artworkContainer = findArtworkContainer(bookmarkButton);
      const metadata = artworkContainer ? pixivCache.getContainerMetadata(artworkContainer) : null;
      const url = window.location.href;
      let illustId;
      let authorId = "unknown_author";
      let authorName = "unknown_author_name";
      let images = [];
      let totalImages = 1;
      if (url.startsWith("https://www.pixiv.net/artworks/")) {
        illustId = url.match(/artworks\/(\d+)/)?.[1] || "unknown_id";
        const authorLinkElement = metadata?.userLinks?.[0] || document.querySelector('a[href*="/users/"]');
        if (authorLinkElement) {
          authorId = authorLinkElement.href.match(/users\/(\d+)/)?.[1] || "unknown_author";
          authorName = authorLinkElement.textContent.trim();
          if (!authorName || authorName.includes("\u67E5\u770B") || authorName.includes("\u66F4\u591A") || authorName.length > 50) {
            const authorImg = authorLinkElement.querySelector("img");
            if (authorImg && authorImg.alt && !authorImg.alt.includes("\u7684\u63D2\u753B")) {
              authorName = authorImg.alt.trim();
            }
          }
        }
        if (metadata?.images?.length) {
          images = metadata.images;
        } else {
          const mainImage = document.querySelector("main img");
          if (mainImage) {
            images = [mainImage];
          }
        }
        const pageIndicator = document.querySelector("[data-gtm-value]");
        if (pageIndicator) {
          const match = pageIndicator.textContent.match(/(\d+)\/(\d+)/);
          if (match)
            totalImages = parseInt(match[2], 10);
        }
      } else if (artworkContainer) {
        const artworkLinks = metadata?.links?.length ? metadata.links : Array.from(artworkContainer.querySelectorAll('a[href*="/artworks/"]'));
        let mainArtworkLink = null;
        if (artworkLinks.length > 1) {
          mainArtworkLink = Array.from(artworkLinks).reduce((largest, current) => {
            const largestRect = largest.getBoundingClientRect();
            const currentRect = current.getBoundingClientRect();
            return currentRect.width * currentRect.height > largestRect.width * largestRect.height ? current : largest;
          });
        } else {
          mainArtworkLink = artworkLinks[0];
        }
        if (mainArtworkLink) {
          illustId = mainArtworkLink.href.match(/artworks\/(\d+)/)?.[1];
        } else {
          illustId = artworkContainer.querySelector("[data-gtm-value]")?.getAttribute("data-gtm-value");
        }
        const authorLink = metadata?.userLinks?.[0] || artworkContainer.querySelector('a[href*="/users/"]');
        if (authorLink) {
          authorId = authorLink.href.match(/users\/(\d+)/)?.[1] || "unknown_author";
          authorName = authorLink.textContent.trim();
          if (!authorName || authorName.includes("\u67E5\u770B") || authorName.includes("\u66F4\u591A") || authorName.length > 50) {
            const authorImg = authorLink.querySelector("img");
            if (authorImg && authorImg.alt && !authorImg.alt.includes("\u7684\u63D2\u753B")) {
              authorName = authorImg.alt.trim();
            }
          }
        }
        const allImages = metadata?.images?.length ? metadata.images : Array.from(artworkContainer.querySelectorAll("img"));
        let mainImage = null;
        if (allImages.length > 1) {
          const largeImages = allImages.filter((img) => {
            const rect = img.getBoundingClientRect();
            return rect.width > 80 && rect.height > 80;
          });
          if (largeImages.length > 0) {
            mainImage = largeImages.reduce((largest, current) => {
              const largestRect = largest.getBoundingClientRect();
              const currentRect = current.getBoundingClientRect();
              return currentRect.width * currentRect.height > largestRect.width * largestRect.height ? current : largest;
            });
          }
        } else {
          mainImage = allImages[0];
        }
        if (mainImage) {
          images = [mainImage];
          const multiImageIndicator = artworkContainer.querySelector('[class*="sc-"], span');
          if (multiImageIndicator) {
            const match = multiImageIndicator.textContent.match(/(\d+)/);
            if (match && parseInt(match[1], 10) > 1) {
              totalImages = parseInt(match[1], 10);
            }
          }
        }
      }
      if (images.length === 0) {
        return false;
      }
      for (const img of images) {
        if (!img?.src)
          continue;
        const result = buildOriginalImageUrl(img.src, this.proxyManager.getProxyDomain(), illustId);
        if (!result) {
          continue;
        }
        await this.downloadImageSeries(result.url, result.illustId, totalImages, {
          authorId,
          authorName,
          illustId: result.illustId
        });
      }
      return true;
    }
    replaceDomain(url, domain) {
      const parsed = new URL(url);
      parsed.hostname = domain;
      return parsed.toString();
    }
    async downloadImageSeries(baseUrl, illustId, totalImages, metadata) {
      for (let index = 0; index < totalImages; index += 1) {
        const url = baseUrl.replace("_p0", `_p${index}`);
        try {
          await this.downloadWithProxies(url, {
            ...metadata,
            illustId
          });
        } catch (error) {
          await this.handleError(error, {
            action: "downloadImage",
            url,
            retryCount: this.retryManager?.maxRetries || 0
          });
        }
        chrome.runtime.sendMessage({
          action: "downloadProgress",
          current: index + 1,
          total: totalImages,
          platform: "pixiv"
        });
      }
    }
    async downloadWithProxies(url, metadata) {
      const proxyDomain = this.proxyManager.getProxyDomain();
      const proxyUrl = this.replaceDomain(url, proxyDomain);
      await this.downloadImage(proxyUrl, metadata);
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
      try {
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
      } catch (error) {
        const retryUrl = url.endsWith(".png") ? url.replace(".png", ".jpg") : url.endsWith(".jpg") ? url.replace(".jpg", ".png") : null;
        if (!retryUrl) {
          throw error;
        }
        await attemptDownload(retryUrl);
      }
    }
  };

  // src/content.js
  var ContentScript = class {
    constructor() {
      this.platforms = /* @__PURE__ */ new Map();
      this.config = new ConfigManager();
      this.downloader = new Downloader();
      this.retryManager = new RetryManager();
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
            retryManager: this.retryManager
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
