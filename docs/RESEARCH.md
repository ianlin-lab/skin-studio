# Codex 换肤方案调研

调研日期：2026-07-31。

## 采用的参考实现

### Fei-Away / Codex-Dream-Skin

- 仓库：<https://github.com/Fei-Away/Codex-Dream-Skin>
- 检查提交：`cd71dfd120034e73a46d10b2fe3118601d251b8d`（2026-07-30，v1.5.9）
- 观察到的核心方式：官方 Codex 以 `--remote-debugging-address=127.0.0.1` 和本机端口启动；Node injector 读取 `/json/list`、筛选真实 renderer，通过 `Runtime.evaluate` 注入 CSS/DOM。
- 不修改 `.app`、`app.asar` 或代码签名。
- 当前主题包核心：`theme.json`、`theme.css`、一张 `background.webp|jpg|png`；正式包还可带 `manifest.json`、校验和、license。
- `theme.json` schema v1 常用字段：`name`、`image`、`appearance`、`art.focusX/Y`、`art.safeArea`、`art.taskMode`、`colors.*`。
- 其 macOS 适配器记录的稳定锚点包括 `main.main-surface`、`aside.app-shell-left-panel`、`header.app-header-tint`、`.composer-surface-chrome`、`.thread-scroll-container` 和 `[data-message-author-role]`。

Skin Studio 采用相同的“回环 CDP、官方包不落盘修改、恢复优先”原则，但没有复制其安装器/菜单栏结构。Dream Skin CSS 只在通过 `dreamskin-safe-css/1` 白名单验证后使用，不执行任意社区 CSS。

### CodeDrobe / skills

- 仓库：<https://github.com/CodeDrobe/skills>
- 检查提交：`b3f3a9561ee068a4dcee64a6cbf5fece2252fcf4`
- 有价值的设计：把 target adapter 与主题运行时分开；目标匹配必须排除 DevTools、扩展、helper 窗口和非本机 WebSocket；自选端口只可绑定回环地址。

Skin Studio 的 `TargetAdapter` 接口来自这一类解耦思路，第一版只注册 `codex-cdp-v1`。

### 原生 Codex 主题

当前 Codex 还存在 `codex-theme-v1:` 分享字符串/原生外观主题。它主要覆盖颜色、字体与语义色，不解决图片背景、动态素材与半透明面板。社区外部皮肤与原生主题没有统一格式。

第一版没有宣称兼容 `codex-theme-v1:`；选择 Dream Skin v1 作为首个可验证社区导入格式。

## 本机实测差异

- 安装路径：`/Applications/ChatGPT.app`
- bundle id：`com.openai.codex`
- `CFBundleName`：`ChatGPT`
- 版本：`26.727.40816`
- 架构：arm64
- 新版 renderer URL 为 `app://-/index.html`，不是旧方案常见的 `file://`。
- CDP 还暴露 `avatar-overlay` page 和定价 webview；适配器会排除 overlay/helper 与非 `page` target。
- 本机版本已将主画布换成 `main[data-app-shell-main-surface]`。Skin Studio 同时兼容新旧锚点，并优先覆写 Codex 自身公开的 `--color-token-*` / `--vscode-*` 语义变量，使按钮、文字、菜单和面板形成完整配色。

## 结论

运行时 CDP 注入是当前最适合本项目的方案：

- 比修改 `app.asar` 更可逆，不破坏签名；
- 比官方色板主题更能表达图片、动态素材和玻璃面板；
- 能在切换主题时热更新；
- 失败时可以移除注入或重启原生 Codex。

代价是 CDP 会扩大同一 macOS 用户下本机进程的控制面，因此必须只绑定 `127.0.0.1`、明确提示重启、校验 target，并把恢复作为一级操作。
