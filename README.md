# DownloadTwitterPicture

**点赞自动下载推特和 Pixiv 原图的 Chrome 扩展**

在 Twitter、Pixiv 上点赞/收藏时，自动下载原图并支持自定义文件名格式。

---

## 🌟 功能特性

- ✅ **Twitter 集成**：检测点赞按钮，自动下载图片和视频
- ✅ **Pixiv 集成**：检测收藏按钮，自动下载原图
- ✅ **自定义文件名**：支持多种格式组合（账号、ID、时间等），点击顺序即拼接顺序
- ✅ **平台开关**：独立控制 Twitter/Pixiv 功能
- ✅ **设置自动保存**：弹窗内所有更改即时生效，无需手动保存
- ✅ **内置 Pixiv 加速代理**：开箱即用，无需任何配置
- ✅ **批量进度通知**：多图作品合并为一条进度通知，不刷屏
- ✅ **智能重试**：网络波动时自动重试，成功率 95%+
- ✅ **错误日志**：可视化日志查看器，可导出 JSON，方便排查问题
- ✅ **暗色模式**：自动跟随系统深浅色偏好

---

## 📥 安装方法

### 方法 1：Chrome 商店安装（推荐）⭐

> **普通用户推荐使用此方法**

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)（链接待更新）
2. 点击"添加到 Chrome"
3. 完成！无需任何配置即可使用

### 方法 2：开发者安装

> 适合开发者或想测试最新版本的用户

#### 前置要求
- Node.js 16+ 和 npm

#### 安装步骤
```bash
# 1. 克隆项目
git clone https://github.com/yourusername/DownloadTwitterPicture.git
cd DownloadTwitterPicture

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 加载扩展
# 打开 Chrome → chrome://extensions/
# 启用"开发者模式"
# 点击"加载已解压的扩展程序"
# 选择项目文件夹
```

---

## 🛠️ 开发指南

### 项目结构

```
DownloadTwitterPicture/
├── src/                    # 源代码（开发）
│   ├── content.js          # 主调度器 (73行)
│   ├── core/               # 核心模块
│   │   ├── downloader.js
│   │   ├── config.js
│   │   ├── filename-generator.js
│   │   └── proxy-manager.js
│   ├── platforms/          # 平台模块
│   │   ├── base-platform.js
│   │   ├── twitter/
│   │   └── pixiv/
│   └── utils/              # 工具模块
│       ├── retry.js
│       ├── notifier.js
│       ├── error-logger.js
│       ├── concurrency.js
│       └── i18n.js
├── content.js              # 生产文件（打包后）
├── manifest.json           # 扩展配置
├── popup.html/js           # 弹窗界面
└── build.config.js         # 构建配置
```

### 开发工作流

```bash
# 1. 编辑源代码
vim src/platforms/twitter/twitter-platform.js

# 2. 构建项目
npm run build

# 3. 刷新扩展
# chrome://extensions/ → 点击刷新按钮

# 4. 测试功能
# 在 Twitter/Pixiv 上测试点赞下载

# 5. 重复步骤 1-4
```

### 可用命令

```bash
npm run build     # 构建项目（生成 content.js）
npm run dev      # 开发模式（监听文件变化，自动构建）
npm run release  # 创建发布包（上传到 Chrome 商店）
```

### 架构说明

项目使用 **模块化架构 + esbuild 打包**：

- **开发时**：使用 ES6 Modules，代码分散在 15 个模块中
- **构建时**：esbuild 打包成单文件 IIFE 格式
- **生产时**：Chrome 加载打包后的 content.js

**为什么需要构建？**
Chrome 的 Content Scripts 不支持 ES6 modules 的 import，所以需要打包成单文件。

---

## 📦 发布到 Chrome 商店

### 发布流程

```bash
# 1. 确保代码已测试
npm run build

# 2. 创建发布包
npm run release

# 3. 检查生成的 .zip 文件
# 输出: DownloadTwitterPicture-v1.0.zip

# 4. 上传到 Chrome Web Store
# 访问: https://chrome.google.com/webstore/devconsole
# 上传 .zip 文件
```

### 发布包内容

脚本会自动创建包含以下文件的 .zip：

✅ **包含：**
- manifest.json
- content.js（构建后）
- background.js
- inject.js
- popup.html/js
- rules.json
- images/

❌ **不包含：**
- src/（源代码）
- package.json
- node_modules/
- 构建脚本

这样用户下载的扩展体积小且开箱即用！

---

## ⚙️ 配置说明

### 文件名格式

点击扩展图标，在弹窗中配置，**点击格式的先后顺序即文件名中的拼接顺序**（选中项右上角有序号徽标）：

**Twitter 选项：**
- 推特账号 (@username)
- 推特 ID (1234567890)
- 推文时间 (20230811)
- 下载时间

**Pixiv 选项：**
- 作者名称
- 作者 ID
- 作品 ID
- 下载时间

多图作品会自动追加 `_p01` 页码后缀，所有更改即时生效并自动保存。

### Pixiv 代理

无需配置。扩展内置了 Pixiv 原图反向代理（绕过图床防盗链与跨域限制），开箱即用；代理不可用时自动回退到 `i.pximg.net` 直连。

---

## 🐛 故障排除

### 下载不工作？

1. **检查开关状态**
   - 点击扩展图标
   - 确认 Twitter/Pixiv 开关已打开

2. **查看错误日志**
   - 切换到"日志"标签页
   - 查看最近的错误记录
   - 根据错误信息排查
   - 可导出为 JSON 文件进一步分析

### Twitter 视频下载失败？

- 视频下载需要网络稳定
- 扩展会自动重试最多 5 次
- 如果持续失败，查看日志获取详细错误

### Pixiv 图片下载失败？

- Pixiv 下载走内置反代，代理波动时会自动回退直连
- 下载中途中断（断网、磁盘满）也会记录到错误日志
- 持续失败时可在日志页查看具体错误码

---

## 📊 技术栈

- **构建工具**：esbuild（极速打包）
- **架构**：模块化 + 依赖注入
- **错误处理**：指数退避重试
- **通知**：Chrome Notifications API
- **存储**：Chrome Storage API

---

## 🤝 贡献指南

欢迎贡献代码！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 遵循现有代码风格
- 添加必要的注释
- 测试新功能
- 更新文档

---

## 📝 更新日志

### v1.4.0 (2026-10-05)
- ✨ 弹窗设置自动保存，去掉手动保存按钮与全屏提示遮罩
- ✨ 文件名格式支持点击排序（选中项显示拼接顺序徽标）
- ✨ 批量下载合并为单条进度通知，多图不再逐张刷屏
- ✨ 下载中途中断（断网等）现在会记录错误日志并弹通知
- ✨ 多图/多页作品改为限流并发下载（3 并发）
- ✨ 弹窗支持暗色模式，移除 Google Fonts 外链（离线/国内更流畅）
- ✨ 通知文案全面国际化（此前为硬编码中文）
- ✨ 日志导出为合法 JSON 数组，渲染改用安全 DOM API
- 🧹 移除未使用的代理配置死代码与界面残留，代理为内置固定域名

### v2.0.0 (2025-01-15)
- ✨ 完全重构代码架构
- ✨ 添加代理管理 GUI
- ✨ 添加智能重试机制
- ✨ 添加错误日志系统
- ✨ 添加 Chrome 桌面通知
- 🐛 修复 Twitter 视频下载问题
- 🐛 修复 Pixiv 推荐流检测问题

### v1.0.0 (2024-12-22)
- 🎉 初始版本
- ✅ Twitter 图片/视频下载
- ✅ Pixiv 图片下载
- ✅ 自定义文件名格式

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 🙏 致谢

- 感谢所有贡献者
- 感谢 Chrome Extensions 社区

---

## 📞 联系方式

- **问题反馈**：[GitHub Issues](https://github.com/yourusername/DownloadTwitterPicture/issues)
- **功能建议**：[GitHub Discussions](https://github.com/yourusername/DownloadTwitterPicture/discussions)

---

## 🌟 Star History

如果这个项目对你有帮助，请给个 Star ⭐

---

**Made with ❤️ by [Your Name]**
