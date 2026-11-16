# 功能验收与发布账本

本文件是验收入口。自动测试、真实网页检查、真实 Chrome 扩展下载与商店审核状态分别记录；模拟通过不代表真实站点端到端通过。

## 1.4.1 范围与基线

- 用户反馈：Twitter 页面出现 Pixiv `handleAction` 非法选择器错误。
- 用户要求：先修复并测试，再打包上传、提交与推送，不再遗漏源码同步。
- 基线：`abd5356` 保存先前未提交的本地 1.4.0；它不是经商店包逐字节比对的快照。
- 目标：1.4.1；保持原有设置、权限、文件名格式和内置代理配置。

## 可判定功能清单

| ID | 功能 / 成功条件 | 自动证据 | 真实通道证据 |
|---|---|---|---|
| HOST-01 | X/Twitter 上只注册 Twitter；关闭 Twitter 后不回退 Pixiv；切换设置保持隔离 | `tests/content.test.js` | DTP_DIAG_INIT 日志 + x.com 注入按钮实测 |
| HOST-02 | Pixiv 上只注册 Pixiv；伪装域名均不匹配 | `tests/content.test.js`, `tests/platform-host.test.js` | 真实 pixiv.net DIAG 日志 |
| PIX-01 | 只识别带明确收藏标识的交互按钮；分享、通知、禁用按钮不触发 | `tests/pixiv-detector.test.js` | 真实页面 44 控件仅 8 收藏命中 |
| PIX-02 | 下载点击卡片对应作品；缺关联/多 ID 不猜测全页第一张 | `tests/pixiv-platform.test.js` | 真实推荐卡片按点击作品下载 |
| PIX-03 | SPA 复用卡片后读取新 ID；详情页推荐卡片优先于主作品 URL | `tests/pixiv-platform.test.js` | 真实详情页双卡片抽取验证 |
| PIX-04 | 获取元数据与原图页；/pages 失败可用 meta 原图；单页失败不终止整批 | `tests/pixiv-api.test.js`, `tests/pixiv-platform.test.js` | 真实 `/ajax/illust/152133200` 200 |
| PIX-05 | 代理失败回退原图直连；直连不发跨域 HEAD；真实文件下载完成 | `tests/pixiv-platform.test.js`, `tests/background.test.js` | 代理与直连各下载一次，字节一致 |
| TW-01 | 点赞图片按原图 URL 下载并保留文件名与去重 | `tests/twitter-detector.test.js`, `tests/downloader.test.js`, `tests/filename-generator.test.js` | 真实推文 2 图落盘 |
| TW-02 | 视频/GIF 识别、桥接缓存与 API 回退不回归 | `tests/twitter-detector.test.js`, `tests/twitter-platform.test.js`, `tests/twitter-api.test.js` | 真实视频 3.8MB MP4 落盘 |
| SET-01 | 开关即时保存/跨页更新，文件名组件点击排序持久化 | `tests/content.test.js`（部分） | 弹窗改置重开验证 + 截图 |
| LOG-01 | 记录错误平台、页面路径、版本和 stack；不存页面 query/hash；日志列表/导出无脚本注入 | `tests/error-logger.test.js`, `tests/base-platform.test.js` | 真实 downloadInterrupted 日志验证 |
| NOTIF-01 | 重试、批次进度、下载中断保留原有通知与错误记录 | `tests/retry.test.js`, `tests/concurrency.test.js`, `tests/pixiv-platform.test.js`, `tests/background.test.js` | 通知关闭实测无弹窗异常 |
| PKG-01 | lint/自动测试/构建成功；版本三处一致；ZIP 字节等于当前构建；无开发缓存 | `npm run release`, `scripts/verify-release.js` | SHA-256 已记录于执行记录 |
| PUB-01 | 商店上传实际 ZIP 并确认草稿/审核版本；不能把提交审核写成上线 | 不适用 | 待记录 |
| GIT-01 | 提交、标签、Gitea 远端 hash 一致且工作区干净 | Git 命令结果 | 待记录 |

## 本轮执行记录

- 基线自动测试：10 个文件 / 88 项通过（提交 `abd5356`）。
- 修复前新增回归：38 项中 25 失败、13 通过；日志为临时文件 `DownloadTwitterPicture-regression-before.log`。
- 最终自动测试：16 个文件 / 156 项全部通过（`npm run check`，含 lint 与构建）。
- 真实 Chrome（Mac，v157，扩展 ID `kjjiegdcpgiclfjapalpmglacfgbfebm`，重载后 v1.4.1）：
  - HOST-01/02：`DTP_DIAG_INIT` 仅注册当前站平台；伪装域名单测覆盖；`x.com` 页面注入 like/unlike/reply/bookmark 按钮点击，无 Pixiv 报错、无错误日志。
  - PIX-01~05：真实 Pixiv 详情页（作品 152133200）注入隔离卡片，点击后经代理完整下载 2,265,561 字节原图；真实推荐卡片抽取验证点击作品 151497562 下载对应原图（不再误取主作品）；直连 `i.pximg.net` 兜底经后台 fetch 完成下载且字节与代理下载完全一致；无跨域 HEAD。
  - TW-01/02：真实推文图片两张（约 25 KB、187 KB）按 `mediaId.jpeg` 落盘；inject 桥接捕获 5 条真实视频，点击隔离推文下载 3,795,788 字节 MP4。
  - SET-01：开关与文件名格式点击后即时写入 storage，重开弹窗持久生效（截图 `docs/evidence/1.4.1/popup.png`）。
  - LOG-01：下载中断实测写入 `downloadInterrupted`（修复直连前），后台 fetch 失败 403/HTML 响应由单测覆盖拒绝下载；日志含页面路径/版本/堆栈且无 query 参数（单测）。
  - NOTIF-01：通知关闭时批量进度不弹通知（单测），真实下载完成无异常日志。
  - 扩展页无 runtime/manifest 错误；服务 worker 正常。
- 发布包：`DownloadTwitterPicture-v1.4.1.zip`，117.47 KB，SHA-256 `a6f34201aae21780d5cf7bdd9686a298d3bcab2bb107c3f7e5753bbc5943f813`；`scripts/verify-release.js` 校验包内字节与工作区一致、三处版本一致、JS 可解析、无开发缓存，校验和写入 `.sha256`。
- Win10 实机：NOT_RUN（无 Windows 环境；已修复的引号缺陷为跨平台确定性 Bug，Mac 已复现）。
- 商店与 Git 外部状态：见下节，上传/提交后回填。

## 真实测试与发布门槛

1. 在本会话拥有的 Chrome 标签页操作，不改用户其他标签页。优先只读检查真实站点 DOM，使用隔离测试页面验证点击与下载，避免对真实账号点赞/收藏造成写入。
2. 明确记录隔离页面的模拟接口与 Chrome 的真实 downloads/storage/service-worker 通道，不能混称真实站点完整端到端。
3. 无 Windows 实机则 Win10 标记 NOT_RUN；Mac Chromium 通过不等于跨系统全部验收。
4. 任何核心流程失败先修复；外部认证/服务阻塞则报告 BLOCKED，不隐藏、也不伪造通过。
5. 发布清单：版本一致 → 测试 → 构建/ZIP 校验 → 浏览器验证 → 提交源码及构建产物 → 推送并核验 → 上传 ZIP → 提交审核并核验。不能只完成 ZIP。

## 外部发布状态（2026-11-16 回填）

- 提交：`abd5356`（1.4.0 基线）→ `27df3f3`（1.4.1 修复），工作区已清空。
- Gitea：`main = 27df3f3`、tag `v1.4.1`，`git ls-remote` 已核验（origin：gitea.xixi.heiyu.space/zhongzijian/DownloadTwitterPicture）。
- GitHub 镜像：同上 hash，已核验（github：rayleighzhongrui/DownloadTwitterPictur）。
- 商店：ZIP（SHA-256 `a6f34201…`，117.47 KB）已上传为草稿 v1.4.1 并提交审核，状态 **Pending review**；Published 仍为 1.3.1。**待审核 ≠ 已上线**，通过后按勾选自动发布。
- 商店上传方式备注：开发者后台的文件输入框会吞掉 CDP setFileInputFiles 与跨调用 DataTransfer 注入；成功路径是打开上传对话框后在同一渲染周期内注入 File 并派发 change 事件（成功后输入框被清空并跳转，Package 页 Draft 变为 1.4.1）。
