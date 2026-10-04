# Privacy Policy — Download Twitter & Pixiv Original Images

_Last updated: 2026-10-04 · Applies to version 1.3.x and later_

## Summary

**This extension does not collect, transmit, or sell any personal data.** All user data stays on the user's device. There are no analytics, no trackers, no advertising, and no remote code.

## What the extension stores

| Data | Where | Purpose |
|---|---|---|
| Filename format preferences, platform on/off switches, notification toggle | `chrome.storage.sync` (the user's own Chrome profile) | Remembers the user's settings. Synced only through the user's own Chrome account — never sent to the developer. |
| Error logs (failed URL, error message, timestamp) | `chrome.storage.local` (device only) | Lets the user review and export download failures from the popup. Never leaves the device. |

No account information, browsing history, credentials, or identifiers are stored.

## What the extension reads on pages

When the user likes a tweet on Twitter/X or bookmarks an artwork on Pixiv, the content script reads the media URLs and the author name **from that specific post only**, in memory, solely to build the downloaded file's name. This data is not stored and not transmitted anywhere except the download request itself.

## Network requests

1. **Twitter/X media and Pixiv AJAX endpoints** — requested directly by the browser as part of the download the user explicitly triggered.
2. **Pixiv image proxy** — Pixiv's image CDN (`i.pximg.net`) requires a `pixiv.net` Referer header. Pixiv image requests may be forwarded through the developer's Cloudflare Worker reverse proxy (`pixiv.zhongrui.app`), which only adds this header and forwards the image bytes. The proxy does not store, log, or analyze any data. No account or identity information is included in these requests.

## Permissions and why they are needed

- **downloads** — save the media file to the user's Downloads folder (the extension's single purpose).
- **declarativeNetRequest** (+ host permission for `i.pximg.net` only) — add the `Referer` header required by Pixiv's CDN for the above proxy/direct download to work. No other hosts are modified.
- **storage** — store the settings and local error logs described above.
- **notifications** — inform the user when a download starts or fails.

## Third parties

No data is sold, transferred, or disclosed to any third party. The only external service involved is the developer's Cloudflare Worker described above, which processes image requests transiently and stores nothing.

## Changes

If this policy changes materially, it will be updated on this page and the version number will be bumped.

## Contact

Questions about this policy: **rayleighzhong@gmail.com**

---

# 隐私政策 — 下载 Twitter 和 Pixiv 原图

_最后更新：2026-10-04 · 适用于 1.3.x 及之后版本_

## 概述

**本扩展不收集、不传输、不出售任何个人数据。** 所有用户数据均保存在用户自己的设备上。扩展内无统计分析、无跟踪器、无广告、无远程代码。

## 扩展存储的数据

| 数据 | 位置 | 用途 |
|---|---|---|
| 文件名格式偏好、平台开关、通知开关 | `chrome.storage.sync`（用户自己的 Chrome 账户） | 记住用户设置。仅通过用户自己的 Chrome 同步，绝不会发送给开发者。 |
| 错误日志（失败的 URL、错误信息、时间戳） | `chrome.storage.local`（仅本机） | 供用户在弹窗中查看、导出下载失败记录。永不离开设备。 |

不存储任何账户信息、浏览历史、凭据或用户标识。

## 扩展在页面上读取的内容

当用户在 Twitter/X 点赞或在 Pixiv 收藏作品时，内容脚本**仅读取该条内容**的媒体地址与作者名，且仅在内存中处理，用于生成下载文件的文件名。该数据不会被存储，也不会被传输到任何地方（下载请求本身除外）。

## 网络请求

1. **Twitter/X 媒体与 Pixiv AJAX 接口** — 由浏览器直接请求，属于用户主动触发的下载行为的一部分。
2. **Pixiv 图片代理** — Pixiv 图床（`i.pximg.net`）要求携带 `pixiv.net` 的 Referer 请求头。Pixiv 图片请求可能经由开发者自建的 Cloudflare Worker 反向代理（`pixiv.zhongrui.app`）转发，该代理仅添加此请求头并转发图片数据，不存储、不记录、不分析任何内容。这些请求中不包含任何账户或身份信息。

## 权限及其用途

- **downloads** — 将媒体文件保存到用户的下载目录（扩展的唯一用途）。
- **declarativeNetRequest**（仅含 `i.pximg.net` 一个 host 权限）— 为上述 Pixiv 图床请求注入必需的 `Referer` 请求头。不修改任何其它域名。
- **storage** — 存储上述设置与本地错误日志。
- **notifications** — 在下载开始或失败时告知用户。

## 第三方

不会向任何第三方出售、传输或披露数据。唯一涉及的外部服务是上述开发者自建的 Cloudflare Worker，它仅即时转发图片请求，不存储任何数据。

## 政策变更

若本政策发生重大变更，将更新本页面并提升版本号。

## 联系方式

关于本政策的问题请联系：**rayleighzhong@gmail.com**
