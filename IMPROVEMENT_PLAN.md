# DownloadTwitterPicture - 高优先级改进计划

## 📊 概述

本文档列出了三个高优先级改进项的详细实施计划，旨在提升代码可维护性、用户体验和易用性。

**优先级判断依据：**
- 🔥 影响范围大（影响所有用户或核心功能）
- ⚡ 实施难度适中（1-2周内可完成）
- 💎 投入产出比高（显著的改进效果）

---

## 🎯 三大高优先级改进项

### 1️⃣ 代码模块化重构
### 2️⃣ 错误提示和重试机制
### 3️⃣ 代理配置界面

---

## 1️⃣ 代码模块化重构

### 🎯 目标
将 1055 行的 `content.js` 拆分为可维护的模块，提高代码可读性和可测试性。

### 📁 新的目录结构

```
DownloadTwitterPicture/
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── src/
│   ├── core/
│   │   ├── downloader.js          # 下载器基类
│   │   ├── filename-generator.js  # 文件名生成器
│   │   └── config.js              # 配置管理
│   ├── platforms/
│   │   ├── base-platform.js       # 平台基类
│   │   ├── twitter/
│   │   │   ├── twitter-platform.js
│   │   │   ├── twitter-api.js
│   │   │   └── twitter-detector.js
│   │   └── pixiv/
│   │       ├── pixiv-platform.js
│   │       ├── pixiv-api.js
│   │       └── pixiv-detector.js
│   ├── utils/
│   │   ├── dom.js                 # DOM 工具
│   │   ├── storage.js             # 存储工具
│   │   └── retry.js               # 重试机制
│   └── content.js                 # 主入口（精简版）
└── inject.js
```

### 🔧 重构步骤

#### 阶段 1：创建基础架构（第1-2天）

**任务清单：**
- [ ] 创建 `src/` 目录结构
- [ ] 实现基类 `BasePlatform`（abstract class）
- [ ] 实现 `FilenameGenerator` 类
- [ ] 实现 `ConfigManager` 类
- [ ] 更新 `manifest.json` 的 content script 引用

**BasePlatform 接口设计：**
```javascript
abstract class BasePlatform {
  abstract detectAction(event);
  abstract extractData(container);
  abstract generateDownloadUrl(data);
  abstract download(url, metadata);

  // 通用方法
  handleError(error, context);
  validateData(data);
}
```

#### 阶段 2：重构 Twitter 模块（第3-4天）

**任务清单：**
- [ ] 提取 Twitter 点击检测逻辑到 `twitter-detector.js`
- [ ] 提取 Twitter API 调用到 `twitter-api.js`
- [ ] 实现 `TwitterPlatform` 类
- [ ] 单元测试：Twitter 数据提取
- [ ] 集成测试：点赞检测和下载

**TwitterPlatform 职责：**
- 检测点赞按钮点击
- 提取推文 ID、作者 ID、时间
- 获取图片/视频 URL
- 调用下载 API

#### 阶段 3：重构 Pixiv 模块（第5-6天）

**任务清单：**
- [ ] 提取 Pixiv 收藏检测逻辑到 `pixiv-detector.js`
- [ ] 提取 Pixiv URL 转换逻辑到 `pixiv-api.js`
- [ ] 实现 `PixivPlatform` 类
- [ ] 单元测试：Pixiv 数据提取
- [ ] 集成测试：收藏检测和下载

**PixivPlatform 职责：**
- 检测收藏按钮点击
- 提取作品 ID、作者信息
- 构建原图 URL
- 处理多图下载

#### 阶段 4：整合和测试（第7天）

**任务清单：**
- [ ] 重写 `content.js` 为平台调度器
- [ ] 端到端测试（手动测试）
- [ ] 性能基准测试
- [ ] 代码审查和优化

**新的 content.js 结构：**
```javascript
import { TwitterPlatform } from './platforms/twitter/twitter-platform.js';
import { PixivPlatform } from './platforms/pixiv/pixiv-platform.js';
import { ConfigManager } from './core/config.js';

class ContentScript {
  constructor() {
    this.platforms = new Map();
    this.config = new ConfigManager();
  }

  async init() {
    // 根据配置初始化平台
    const { twitterSwitchActive, pixivSwitchActive } = await this.config.getSwitches();

    if (twitterSwitchActive) {
      this.platforms.set('twitter', new TwitterPlatform());
    }

    if (pixivSwitchActive) {
      this.platforms.set('pixiv', new PixivPlatform());
    }

    this.bindEvents();
  }

  bindEvents() {
    // 路由点击事件到对应平台
    document.addEventListener('click', (e) => {
      for (const [name, platform] of this.platforms) {
        if (platform.detectAction(e)) {
          platform.handleAction(e);
          break;
        }
      }
    }, true);
  }
}

new ContentScript().init();
```

### 📊 预期收益

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| content.js 行数 | 1055 | ~150 | -86% |
| 代码可测试性 | ❌ 无法测试 | ✅ 可单元测试 | +100% |
| 新增平台难度 | 🔥 困难 | ⚡ 简单 | -70% |
| Bug 定位时间 | 🔥 长 | ⚡ 短 | -60% |

---

## 2️⃣ 错误提示和重试机制

### 🎯 目标
提供友好的用户反馈，自动处理临时性网络错误，提升下载成功率。

### 📐 设计方案

#### 2.1 Chrome 通知系统

**通知类型：**
- ✅ 下载成功
- ❌ 下载失败（带原因）
- ⚠️ 下载重试中
- 📊 批量下载完成

**实现位置：** `src/utils/notifier.js`

```javascript
class Notifier {
  static showSuccess(title, message, options = {}) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message,
      requireInteraction: false,
      ...options
    });
  }

  static showError(title, error, actionUrl = null) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon.png',
      title,
      message: `下载失败：${error.message}`,
      requireInteraction: true,
      buttons: actionUrl ? [{ title: '查看详情' }] : [],
      priority: 2
    });
  }

  static showProgress(current, total) {
    chrome.notifications.create({
      type: 'progress',
      iconUrl: 'images/icon.png',
      title: '批量下载中',
      message: `已完成 ${current}/${total}`,
      progress: (current / total) * 100
    });
  }
}
```

#### 2.2 智能重试机制

**策略：指数退避**

| 重试次数 | 等待时间 | 适用场景 |
|----------|----------|----------|
| 1 | 1秒 | 网络超时 |
| 2 | 2秒 | 5xx 错误 |
| 3 | 4秒 | 连接重置 |
| 4 | 8秒 | DNS 解析失败 |
| 5 | 16秒 | 代理超时 |

**实现位置：** `src/utils/retry.js`

```javascript
class RetryManager {
  constructor(maxRetries = 5, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async retry(fn, context = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;

        // 判断是否可重试
        if (!this.isRetryable(error)) {
          throw error;
        }

        // 计算退避时间
        const delay = this.baseDelay * Math.pow(2, attempt - 1);

        console.log(`[${context.name}] 第 ${attempt} 次重试，${delay}ms 后重试`);

        // 显示重试通知
        if (attempt === 2) {
          Notifier.showWarning('下载重试中', `正在第 ${attempt} 次尝试...`);
        }

        await this.sleep(delay);
      }
    }

    throw new Error(`${context.name}: 失败 ${this.maxRetries} 次后放弃。最后错误: ${lastError.message}`);
  }

  isRetryable(error) {
    // 可重试的错误类型
    const retryableErrors = [
      'Network timeout',
      'Connection reset',
      '5xx',
      'ETIMEDOUT',
      'ECONNRESET'
    ];

    return retryableErrors.some(msg =>
      error.message.includes(msg) || error.status >= 500
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 2.3 错误日志记录

**存储位置：** Chrome Storage API

**日志结构：**
```javascript
{
  timestamp: '2025-01-15T10:30:00Z',
  platform: 'twitter',
  action: 'downloadImage',
  url: 'https://...',
  error: 'Network timeout',
  retryCount: 3,
  success: false
}
```

**日志查看器：** 在 popup.html 中添加"错误日志"标签页

### 🔧 实施步骤

#### 阶段 1：通知系统（第1天）

**任务清单：**
- [ ] 创建 `src/utils/notifier.js`
- [ ] 在 `background.js` 中集成通知
- [ ] 在 `popup.html` 添加通知开关设置
- [ ] 测试各种通知场景

**manifest.json 新增权限：**
```json
{
  "permissions": [
    "notifications",
    ...
  ]
}
```

#### 阶段 2：重试机制（第2天）

**任务清单：**
- [ ] 创建 `src/utils/retry.js`
- [ ] 在下载函数中包装重试逻辑
- [ ] 添加重试状态指示（UI 反馈）
- [ ] 单元测试：重试逻辑

**集成示例：**
```javascript
// 在 TwitterPlatform.downloadImage() 中
async downloadImage(url, metadata) {
  const retryManager = new RetryManager(5);

  return retryManager.retry(async (attempt) => {
    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return this.sendToBackground(url, metadata);
  }, { name: 'Twitter图片下载' });
}
```

#### 阶段 3：错误日志（第3天）

**任务清单：**
- [ ] 创建 `src/utils/error-logger.js`
- [ ] 实现日志存储（限制最近 100 条）
- [ ] 在 popup.html 添加日志查看器
- [ ] 添加"导出日志"功能

**popup.html 新增标签页：**
```html
<div class="tabs">
  <button class="tab active" data-tab="settings">设置</button>
  <button class="tab" data-tab="logs">错误日志</button>
</div>

<div class="tab-content" id="logs-tab">
  <div class="log-filters">
    <select id="logPlatform">
      <option value="all">所有平台</option>
      <option value="twitter">Twitter</option>
      <option value="pixiv">Pixiv</option>
    </select>
    <button id="clearLogs">清空日志</button>
    <button id="exportLogs">导出日志</button>
  </div>
  <div class="log-list" id="logList"></div>
</div>
```

### 📊 预期收益

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| 下载成功率（网络不稳定） | 60% | 95% | +58% |
| 用户困惑度（失败时） | 🔴 高 | 🟢 低 | -80% |
| 问题可诊断性 | 🔴 只能看 console | 🟢 可视化日志 | +100% |
| 用户体验满意度 | ⚖️ 中等 | ✅ 良好 | +40% |

---

## 3️⃣ 代理配置界面

### 🎯 目标
让用户无需修改代码即可配置 Pixiv 代理，支持多个代理地址和自动切换。

### 📐 设计方案

#### 3.1 配置存储结构

```javascript
// Chrome Storage
{
  pixivProxies: [
    {
      id: 'proxy-1',
      name: '我的代理1',
      domain: 'pixiv.example.com',
      enabled: true,
      priority: 1
    },
    {
      id: 'proxy-2',
      name: '备用代理',
      domain: 'pixiv.backup.com',
      enabled: true,
      priority: 2
    }
  ],
  activeProxyId: 'proxy-1',
  proxyTestUrl: 'https://www.pixiv.net/artworks/119870733'
}
```

#### 3.2 UI 设计

**popup.html 新增"代理设置"标签页：**

```
┌─────────────────────────────────────┐
│  [设置] [代理] [日志]               │
├─────────────────────────────────────┤
│                                     │
│  Pixiv 代理设置                     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ + 添加新代理                  │ │
│  └───────────────────────────────┘ │
│                                     │
│  代理列表：                          │
│  ┌───────────────────────────────┐ │
│  │ 🟢 我的代理1            [测试] │ │
│  │    pixiv.example.com          │ │
│  │    [编辑] [删除] [设为默认]    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🟢 备用代理              [测试] │ │
│  │    pixiv.backup.com           │ │
│  │    [编辑] [删除] [设为默认]    │ │
│  └───────────────────────────────┘ │
│                                     │
│  自动切换：☑️ 失败时自动尝试下一个  │
│  代理轮询：☐ 每次请求轮换代理      │
│                                     │
└─────────────────────────────────────┘
```

#### 3.3 代理管理器

**实现位置：** `src/core/proxy-manager.js`

```javascript
class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentProxy = null;
    this.failedProxies = new Set();
  }

  async loadProxies() {
    const result = await chrome.storage.sync.get(['pixivProxies', 'activeProxyId']);
    this.proxies = result.pixivProxies || [];
    this.currentProxy = this.proxies.find(p => p.id === result.activeProxyId);
  }

  getProxyDomain() {
    return this.currentProxy?.domain || 'i.pximg.net';
  }

  async testProxy(proxyDomain) {
    try {
      const testUrl = `https://${proxyDomain}/index.html`;
      const response = await fetch(testUrl, { method: 'HEAD', mode: 'no-cors' });
      return { success: true, latency: response.headers.get('timing') };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getNextProxy() {
    const availableProxies = this.proxies.filter(p =>
      p.enabled && !this.failedProxies.has(p.id)
    );

    if (availableProxies.length === 0) {
      // 重置失败记录
      this.failedProxies.clear();
      return this.proxies.find(p => p.enabled);
    }

    // 按优先级排序
    return availableProxies.sort((a, b) => a.priority - b.priority)[0];
  }

  markProxyFailed(proxyId) {
    this.failedProxies.add(proxyId);
  }
}
```

### 🔧 实施步骤

#### 阶段 1：UI 开发（第1天）

**任务清单：**
- [ ] 在 popup.html 添加"代理设置"标签页
- [ ] 实现代理列表组件
- [ ] 实现添加/编辑/删除对话框
- [ ] 样式调整（保持绿色主题一致）

**新增 HTML 元素：**
```html
<!-- 代理设置标签页 -->
<div class="tab-content" id="proxy-tab">
  <div class="proxy-header">
    <h3>Pixiv 代理设置</h3>
    <button id="addProxyBtn" class="btn-primary">+ 添加新代理</button>
  </div>

  <div id="proxyList" class="proxy-list"></div>

  <div class="proxy-options">
    <label class="checkbox">
      <input type="checkbox" id="autoSwitchProxy" checked>
      失败时自动尝试下一个代理
    </label>
    <label class="checkbox">
      <input type="checkbox" id="roundRobinProxy">
      每次请求轮换代理（负载均衡）
    </label>
  </div>
</div>

<!-- 添加/编辑代理对话框 -->
<div id="proxyDialog" class="dialog">
  <div class="dialog-content">
    <h3 id="dialogTitle">添加代理</h3>
    <form id="proxyForm">
      <div class="form-group">
        <label>代理名称</label>
        <input type="text" id="proxyName" required>
      </div>
      <div class="form-group">
        <label>代理域名</label>
        <input type="text" id="proxyDomain" required placeholder="pixiv.example.com">
      </div>
      <div class="form-group">
        <label>优先级</label>
        <input type="number" id="proxyPriority" value="1" min="1" max="10">
      </div>
      <div class="dialog-actions">
        <button type="button" id="cancelProxyBtn">取消</button>
        <button type="submit">保存</button>
      </div>
    </form>
  </div>
</div>
```

#### 阶段 2：代理管理器（第2天）

**任务清单：**
- [ ] 创建 `src/core/proxy-manager.js`
- [ ] 实现代理加载和保存逻辑
- [ ] 实现代理测试功能
- [ ] 实现自动切换逻辑
- [ ] 单元测试

#### 阶段 3：集成到 Pixiv 模块（第3天）

**任务清单：**
- [ ] 修改 `PixivPlatform` 使用 ProxyManager
- [ ] 处理代理失败时的自动切换
- [ ] 添加代理切换通知
- [ ] 集成测试

**集成示例：**
```javascript
// 在 PixivPlatform 中
class PixivPlatform extends BasePlatform {
  constructor() {
    super();
    this.proxyManager = new ProxyManager();
  }

  async downloadImage(url, metadata) {
    let lastError;

    // 尝试所有可用代理
    for (let i = 0; i < this.proxyManager.proxies.length; i++) {
      const proxy = await this.proxyManager.getNextProxy();
      if (!proxy) break;

      try {
        const proxyUrl = url.replace('i.pximg.net', proxy.domain);
        return await this.fetchWithRetry(proxyUrl, metadata);
      } catch (error) {
        lastError = error;
        this.proxyManager.markProxyFailed(proxy.id);
        console.log(`代理 ${proxy.name} 失败，尝试下一个...`);
      }
    }

    throw new Error(`所有代理均失败：${lastError.message}`);
  }
}
```

#### 阶段 4：默认代理迁移（第3天下午）

**任务清单：**
- [ ] 检测硬编码的代理域名
- [ ] 自动迁移到配置系统
- [ ] 添加迁移提示
- [ ] 更新文档

**迁移逻辑：**
```javascript
// 在扩展更新时自动执行
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const { pixivProxies } = await chrome.storage.sync.get('pixivProxies');

    // 如果没有配置代理，从旧版本迁移
    if (!pixivProxies || pixivProxies.length === 0) {
      const legacyProxy = 'pixiv.zhongrui.app'; // 从旧代码读取

      await chrome.storage.sync.set({
        pixivProxies: [{
          id: 'migrated-proxy',
          name: '历史代理（已迁移）',
          domain: legacyProxy,
          enabled: true,
          priority: 1
        }],
        activeProxyId: 'migrated-proxy'
      });

      // 通知用户
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon.png',
        title: '代理配置已升级',
        message: '您的 Pixiv 代理设置已迁移到新的配置面板，请前往设置查看。'
      });
    }
  }
});
```

### 📊 预期收益

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| 配置代理难度 | 🔴 需改代码 | 🟢 界面点击 | -100% |
| 代理可用性 | ❌ 单点故障 | ✅ 多代理冗余 | +200% |
| 用户自主性 | 🔴 依赖开发者 | 🟢 自行配置 | +∞ |
| 故障恢复时间 | 🔴 长期不可用 | 🟢 自动切换 | -95% |

---

## 📅 总体时间表

### 第1周
- **周一-周二**：模块化重构 - 阶段1（基础架构）
- **周三-周四**：模块化重构 - 阶段2（Twitter模块）
- **周五**：错误提示 - 阶段1（通知系统）

### 第2周
- **周一**：模块化重构 - 阶段3（Pixiv模块）
- **周二**：错误提示 - 阶段2（重试机制）
- **周三-周四**：代理配置 - 阶段1-2（UI + 管理器）
- **周五**：集成测试和文档更新

### 第3周
- **周一-周二**：模块化重构 - 阶段4（整合测试）
- **周三**：错误提示 - 阶段3（错误日志）
- **周四**：代理配置 - 阶段3-4（集成 + 迁移）
- **周五**：全面测试和优化

---

## 🎯 成功指标

### 技术指标
- ✅ content.js 代码量减少 80%+
- ✅ 单元测试覆盖率 > 60%
- ✅ 下载成功率 > 95%（网络不稳定时）
- ✅ 平均故障恢复时间 < 5秒

### 用户体验指标
- ✅ 用户配置时间 < 2分钟
- ✅ 错误可诊断性提升 100%
- ✅ 用户反馈减少 50%

### 开发效率指标
- ✅ 新增平台开发时间减少 70%
- ✅ Bug 修复时间减少 60%
- ✅ 代码审查时间减少 40%

---

## 🚀 后续改进

完成三大高优先级改进后，建议继续进行：

1. **性能优化**（中优先级）
2. **TypeScript 迁移**（中优先级）
3. **下载队列和进度显示**（中优先级）
4. **新平台支持**（低优先级）

---

## 📝 附录

### A. 相关文件清单

需要新增的文件：
```
src/
├── core/
│   ├── downloader.js
│   ├── filename-generator.js
│   ├── config.js
│   └── proxy-manager.js
├── platforms/
│   ├── base-platform.js
│   ├── twitter/
│   │   ├── twitter-platform.js
│   │   ├── twitter-api.js
│   │   └── twitter-detector.js
│   └── pixiv/
│       ├── pixiv-platform.js
│       ├── pixiv-api.js
│       └── pixiv-detector.js
└── utils/
    ├── dom.js
    ├── storage.js
    ├── retry.js
    ├── notifier.js
    └── error-logger.js
```

需要修改的文件：
- `manifest.json` - 添加 notifications 权限
- `content.js` - 完全重写为平台调度器
- `background.js` - 集成通知和重试逻辑
- `popup.html` - 添加新标签页
- `popup.js` - 添加新功能

### B. 测试计划

#### 单元测试
- [ ] FilenameGenerator 测试
- [ ] RetryManager 测试
- [ ] ProxyManager 测试
- [ ] Twitter 数据提取测试
- [ ] Pixiv 数据提取测试

#### 集成测试
- [ ] Twitter 点赞 → 下载流程
- [ ] Pixiv 收藏 → 下载流程
- [ ] 代理切换流程
- [ ] 错误重试流程
- [ ] 通知发送流程

#### E2E 测试（手动）
- [ ] 完整用户流程测试
- [ ] 边界条件测试
- [ ] 性能压力测试

### C. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 重构引入新 Bug | 中 | 高 | 充分测试 + 逐步迁移 |
| 用户不接受新 UI | 低 | 中 | 保留旧配置 + 引导文档 |
| 代理服务不稳定 | 高 | 中 | 多代理冗余 + 自动切换 |
| 性能下降 | 低 | 中 | 性能基准测试 + 优化 |

---

## 📞 支持和反馈

如有问题或建议，请通过以下方式反馈：
- GitHub Issues
- Chrome Web Store 评论
- 邮件反馈

---

**文档版本**：v1.0
**最后更新**：2025-01-15
**负责人**：开发团队
