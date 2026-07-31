# Skin Studio

Skin Studio 是一个只在本机运行的 macOS Codex 换肤工具。第一版面向 Apple Silicon，不需要账号、API Key、云服务或付费能力。

它不会修改 Codex 的 `.app`、`app.asar`、代码签名、项目目录或对话数据。应用主题时，Skin Studio 让官方 Codex 以仅绑定 `127.0.0.1` 的 Chrome DevTools Protocol（CDP）会话启动，再向真实渲染器注入可清理的 CSS。恢复默认会移除注入；如果该会话由 Skin Studio 启动，还会正常退出它并按官方方式重新打开 Codex，从而关闭调试端口。

> 这是非 OpenAI 官方的个人工具。Codex 更新可能改变界面结构；遇到异常请先点“恢复 Codex 原生界面”。

## 当前可用能力

- 自动检测 Codex 安装目录、bundle id、版本、Apple Silicon 架构、运行进程和 Skin Studio 主题状态。
- 2 套内置主题：Aurora Glass（深色玻璃基准）与羊皮书房（中世纪草纸、铜金强调、分层视差背景）。旧的三套近似主题不再展示。
- 羊皮书房同时保留为独立主题文件夹：`bundled-themes/medieval-scriptorium`，可从 Skin Studio 的“导入素材”选择该文件夹重新导入一份可编辑副本。
- 导入 PNG、JPEG、GIF、动态/静态 WebP 与 SVG；素材保持在本机。
- 导入 Skin Studio v1 文件夹/ZIP。
- 转换导入 [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) v1 `theme.json` 文件夹、ZIP 或公开 GitHub 仓库。
- 背景铺放、水平/垂直焦点、缩放、亮度、遮罩、面板透明度、玻璃模糊、圆角和任务背景强度调节。
- 完整界面色板：背景、面板、浮层、强调色、强调浅色、辅助色、正文和弱文字。Codex 适配器统一映射主画布、侧栏、顶部栏、模式切换、输入框、按钮、菜单、弹窗、链接、选择态和代码表面。
- 主题预览、应用、热切换、重新应用、删除导入主题、一键恢复默认。
- Skin Studio 自身跟随当前预览主题；可在左下角关闭。
- 首次应用前明确提示并正常重启 Codex；失败自动尝试原生启动回滚。
- 独立异常恢复命令，不会根据模糊进程名结束进程。

## 开发模式

要求：macOS、Apple Silicon、Node.js 22+。本机已使用 Node.js `24.12.0` 验证。

```bash
npm install
npm run dev
```

`npm run dev` 同时启动：

- Vite 渲染进程热更新；
- TypeScript 主进程监听编译；
- Electron 主进程自动重启。

普通界面改动不需要安装 DMG。如果 Electron 下载受网络环境影响，可以使用：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

验证命令：

```bash
npm test
npm run typecheck
npm run build
npm run verify:community -- /path/to/Codex-Dream-Skin/macos/presets/preset-gothic-void-crusade
npm run verify:community -- https://github.com/Fei-Away/Codex-Dream-Skin
```

真实 CDP 测试需传入一个由你专门启动的、本机回环 Codex 调试端口：

```bash
npm run verify:cdp -- --port 9358 --builtin --screenshot ./artifacts/aurora.png
```

该脚本执行“应用 → 重新应用 → 确认 → 截图 → 清理 → 恢复截图”，最后一定尝试移除临时注入。不要把它指向不受信任或非本机端口。

## 如何测试换肤与恢复

1. 用 `npm run dev` 打开 Skin Studio。
2. 选择一个内置主题；在右侧调整焦点、亮度、遮罩、面板和强调色。
3. 点击“应用到 Codex”。
4. 如果 Codex 已在运行但没有调试端口，先保存尚未发送的输入，再在原生确认框中选择“重启并应用”。
5. 检查 Codex 首页、侧栏、项目选择、输入框、任务页、长文本与代码；调整窗口尺寸。
6. 切换另一主题并应用，确认无需再次重启即可热切换。
7. 点击右下角恢复按钮，确认 Codex 以原生方式重新打开，状态显示“Codex 使用原生界面”。

如果 Skin Studio 开发进程异常退出且无法打开界面，可在项目目录运行：

```bash
npm run recover
```

恢复脚本只处理状态文件中记录、且可再次核对可执行文件路径的 Skin Studio 管理进程；PID 已被复用时会拒绝操作，也不会使用 `SIGKILL`。

## 社区主题兼容

当前明确支持并实际验证：

- Skin Studio 内部格式 `skin-studio-theme-v1`。
- Codex Dream Skin v1 的 `theme.json + background.(jpg|png|webp)` legacy 预设。
- Codex Dream Skin Studio ZIP/文件夹中的核心视觉数据：主题名、说明、完整色板、明暗倾向、焦点、任务强度和背景图。
- Dream Skin `dreamskin-safe-css/1` 的保守子集：只允许公开 `data-ds-part` 部件、白名单变量与视觉属性；导入时会解析并规范化，非法规则会让整个包拒绝导入。

实际验证来源：

- 仓库：[Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)
- 验证提交：`cd71dfd120034e73a46d10b2fe3118601d251b8d`（v1.5.9）
- 预设：`macos/presets/preset-gothic-void-crusade`
- 结果：成功转换为 `dream-skin-v1`，保留 JPEG 背景、完整可用色板与 `#c8a55a` 强调色；即使 legacy 包没有 CSS，Skin Studio 的 Codex 适配器也会把色板映射到完整界面。
- 仓库 URL：已通过按需读取 GitHub 文件树与 raw 素材，成功导入该仓库中的 3 个非重复主题。

安全边界：第一版不会执行仓库脚本，也不会原样信任社区 CSS。只有通过 `dreamskin-safe-css/1` 严格校验的 CSS 才会进入运行时；包含 URL、`@` 规则、任意选择器、布局改写或低可读性透明度的 CSS 会被拒绝。因此这里不是“兼容所有 Codex 主题”，也不导入官方 `codex-theme-v1:` 分享字符串。

更多细节见 [主题格式](docs/THEME_FORMAT.md)、[调研记录](docs/RESEARCH.md) 与 [验证记录](docs/VERIFICATION.md)。

## 安全模型

- CDP 只绑定 `127.0.0.1`，不监听局域网地址。
- CDP 本身没有同用户认证；主题会话运行时，不要运行不可信本机程序。
- 注入目标必须同时来自本机 CDP，且命中 Codex 的 `app://`/`file://` 渲染器与稳定语义锚点。
- 主题素材最大 30MB；ZIP 最大 48MB、128 个条目、解压后 80MB；拒绝绝对路径、路径穿越和符号链接。
- GitHub 导入只接受 `https://github.com/<owner>/<repo>` 公开仓库。
- 删除主题使用 macOS 废纸篓；内置主题不能删除；活动主题必须先恢复或切换。
- 结束进程前再次核对 PID 与官方可执行文件路径；只请求正常退出，不强制结束。

## 已知限制

- 仅实现 Codex；适配器接口已预留，但没有伪装支持 Kimi、WorkBuddy 等应用。
- Codex 更新可能让部分面板样式降级。当前已同时适配旧版 `main.main-surface` 与 `26.727.40816` 的 `data-app-shell-main-surface`；恢复入口始终优先。
- 设置页在不同 Codex 版本可能替换整个 shell；主题在设置页可能只保留基础背景。
- 动态 WebP 是否播放取决于当前 Electron/Chromium 解码能力；文件会原样保留。
- 第一版不处理 HEIC/TIFF，不安装网络字体，不执行远程 CSS。
- GitHub `/tree/<ref>` 当前支持不含斜杠的分支/tag；私有仓库不支持。
- Skin Studio 退出后无法监控 Codex renderer reload；macOS 关闭窗口不会退出应用，若要彻底退出建议先恢复默认。

## 构建与 DMG

常规生产前构建：

```bash
npm run build
```

按约定，当前尚未执行 DMG 打包。你确认可以发布后再运行：

```bash
npm run dist:mac
```

DMG 将输出到 `release/`。没有 Apple Developer 账号时构建为未签名版本；首次打开需在 Finder 中右键应用并选择“打开”，或到“系统设置 → 隐私与安全性”确认打开。不要为绕过 Gatekeeper 建议用户全局关闭系统安全策略。
