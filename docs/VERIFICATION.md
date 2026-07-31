# 验证记录

日期：2026-07-31  
机器：macOS / Apple Silicon  
Codex：`26.727.40816`，bundle id `com.openai.codex`

## 自动化

- `npm test`：7 个测试文件，19 个测试通过。
- 覆盖：单一内置主题初始化、参数夹值、本地图片导入、Dream Skin v1 完整色板与 Safe CSS 转换、恶意 CSS/异常 ZIP 拒绝、完整界面注入 payload/恢复表达式。
- `npm run typecheck`：renderer、main、preload、scripts 全部通过。
- `npm run build`：Electron main/preload 与 Vite renderer 生产构建通过。

## 社区主题

来源：

```text
/Fei-Away/Codex-Dream-Skin@cd71dfd120034e73a46d10b2fe3118601d251b8d
/private/tmp/skin-studio-research/dream-skin/
└── macos/presets/preset-gothic-void-crusade/
```

命令：

```bash
npm run verify:community -- /private/tmp/skin-studio-research/dream-skin/macos/presets/preset-gothic-void-crusade
```

结果：

```json
{
  "name": "Gothic Void Crusade",
  "adapter": "dream-skin-v1",
  "assetMime": "image/jpeg",
  "accent": "#c8a55a"
}
```

公开仓库 URL 也完成真实下载验证：

```bash
npm run verify:community -- https://github.com/Fei-Away/Codex-Dream-Skin
```

导入器通过 GitHub 文件树按需读取 `theme.json` 与对应 raw 背景素材，没有下载或执行仓库脚本；成功转换 3 个非重复主题，其中包含 Gothic Void Crusade。

## 真实 Codex renderer

为了不重启承载当前开发任务的 Codex，使用单独的临时 `--user-data-dir` 和 `127.0.0.1:9361` 启动第二个官方实例。

实际 CDP target：

```text
title: Codex
type: page
url: app://-/index.html
```

验证脚本返回：

```text
首次应用：ok
重新应用：ok
revision 确认：ok
完整视觉确认：visualReady=true
清理恢复：stock=true
```

真实 DOM 命中：

```text
aside.app-shell-left-panel: true
main[data-app-shell-main-surface]: true
.composer-surface-chrome: true
```

Aurora Glass 内置主题已实际应用并完成视觉验收；主背景、侧栏、顶栏、聊天/工作切换、输入框、文字与强调按钮均可读。清理后的第二次验收确认 Codex 回到原生浅色界面。验证截图属于临时产物，不保存在仓库中。

测试完成后已正常退出临时 Codex 进程，并删除独立临时用户目录。当前工作 Codex 会话未被重启或修改。

## 重启竞态回归

用户真实流程曾在 Codex 重启后的首个不完整渲染帧立即验证，导致“渲染器未确认主题生效”并自动回滚。现已改为在回环 CDP 建立后继续等待主画布、侧栏和背景生效，最长 24 秒；只有超时才回滚。

使用全新临时用户目录并在 Codex 刚启动后立即运行验证，结果：

```text
readyCount=1
visualReady=true
重新应用：ok
清理恢复：stock=true
```

自动化测试同时覆盖“第一次验证未就绪、第二次验证成功”的启动竞态。

## 桌面 UI

已实际启动 `npm run dev`，通过 macOS 可访问性树和截图检查：

- Codex 版本/运行状态展示；
- 单一基准内置主题卡片、选中态和实时预览；
- Aurora Glass 选中后 Studio 自身背景/强调色跟随；
- 所有 slider、分段控件、强调色、应用/恢复按钮均进入可访问性树；
- 导入入口和状态区可达。

## 尚未执行

- 未按约定生成 DMG。
- 未用用户真实动态 WebP/GIF 做视觉播放验收。
- 未重启当前承载开发会话的主 Codex；进程重启逻辑由独立实例/CDP、严格 PID 校验与单元逻辑共同覆盖。
