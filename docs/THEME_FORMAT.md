# Skin Studio Theme v1

内部格式的目标是让“主题内容”和“目标应用适配”解耦。主题只描述资产与视觉意图；`CodexAdapter` 决定如何把这些字段映射到当前 Codex DOM。未来添加其他应用时，不需要改动已有主题文件。

## 目录结构

```text
my-theme/
├── theme.json
└── background.webp
```

文件必须在同一主题目录中；`asset.file` 只允许普通文件名，不允许子目录、绝对路径或符号链接。

## `theme.json`

```json
{
  "format": "skin-studio-theme-v1",
  "schemaVersion": 1,
  "id": "aurora-glass",
  "name": "Aurora Glass",
  "description": "极光穿过深色玻璃，适合专注工作。",
  "author": "Skin Studio",
  "builtin": false,
  "asset": {
    "file": "background.webp",
    "mime": "image/webp",
    "animated": true
  },
  "presentation": {
    "appearance": "dark",
    "fit": "cover",
    "positionX": 58,
    "positionY": 42,
    "scale": 1,
    "brightness": 0.8,
    "overlayOpacity": 0.24,
    "panelOpacity": 0.7,
    "panelBlur": 24,
    "radius": 17,
    "accent": "#72e0bd",
    "textTone": "light",
    "taskIntensity": 0.4,
    "colors": {
      "background": "#0b1017",
      "panel": "#151b24",
      "panelAlt": "#202a34",
      "accent": "#72e0bd",
      "accentAlt": "#a6f4dc",
      "secondary": "#6da8ff",
      "highlight": "#c48af0",
      "text": "#f2f7f5",
      "muted": "#a7b6b2",
      "line": "#40544f"
    }
  },
  "source": {
    "type": "image",
    "label": "/original/path/background.webp",
    "adapter": "generic-image",
    "importedAt": "2026-07-31T00:00:00.000Z"
  },
  "createdAt": "2026-07-31T00:00:00.000Z",
  "updatedAt": "2026-07-31T00:00:00.000Z"
}
```

## 字段范围

| 字段 | 范围 | 含义 |
|---|---:|---|
| `appearance` | `auto/light/dark` | 目标外观倾向 |
| `fit` | `cover/contain/fill` | 背景适配方式 |
| `positionX/Y` | `0..100` | 背景焦点百分比 |
| `scale` | `0.7..2.2` | 背景缩放 |
| `brightness` | `0.25..1.3` | 背景亮度 |
| `overlayOpacity` | `0..0.8` | 可读性遮罩 |
| `panelOpacity` | `0.3..1` | 主要面板不透明度 |
| `panelBlur` | `0..48` | 玻璃模糊像素 |
| `radius` | `8..26` | 适配器可使用的表面圆角 |
| `accent` | `#rrggbb` | 强调色 |
| `textTone` | `auto/light/dark` | 主要文字色调 |
| `taskIntensity` | `0..1` | 任务页保留背景的强度 |
| `colors.*` | `#rrggbb`（`line` 也可为 `rgb/rgba`） | 由目标适配器映射到完整界面的语义色板 |

读取时所有数值都会被夹在安全范围内。未知字段不会获得执行能力。

## 导入适配器

- `skin-studio-v1`：复制并重新生成安全 ID。
- `generic-image`：从单张图片/GIF/WebP 生成默认参数。
- `dream-skin-v1`：读取 Dream Skin `theme.json` 的 `image`、`appearance`、`art.focusX/Y`、`art.taskMode` 与 `colors.*`，转换到 `presentation`。

主题可以额外包含：

```json
{
  "safeCss": {
    "contract": "dreamskin-safe-css/1",
    "css": "[data-ds-part=\"composer\"] { border-color: var(--ds-theme-color-accent); }"
  }
}
```

导入 Dream Skin 包时，根目录 `theme.css` 也会按同一合同解析。仅允许公开
`data-ds-part` 部件、白名单 `--ds-theme-*` 变量与颜色、边框、阴影、字体等视觉属性；
URL、`@` 规则、伪内容、任意 DOM 选择器和布局改写均被拒绝。它是兼容层，不是任意 CSS 执行器。
