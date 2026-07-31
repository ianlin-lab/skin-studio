import type { ThemeManifest } from "../../shared/types";

export interface BuiltinThemeSeed {
  manifest: ThemeManifest;
  /** Inline art keeps the tiny starter theme self-contained. */
  svg?: string;
  /** Larger motion art is copied from bundled-themes at first launch. */
  bundledAsset?: string;
}

const now = "2026-07-31T00:00:00.000Z";

const auroraSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1200" viewBox="0 0 1920 1200">
  <defs>
    <linearGradient id="base" x1="0" y1="1" x2="1" y2="0">
      <stop stop-color="#071014"/>
      <stop offset=".5" stop-color="#10162b"/>
      <stop offset="1" stop-color="#19112a"/>
    </linearGradient>
    <radialGradient id="mint" cx="78%" cy="12%" r="72%">
      <stop stop-color="#63f2c7" stop-opacity=".86"/>
      <stop offset=".32" stop-color="#4a72dd" stop-opacity=".48"/>
      <stop offset="1" stop-color="#081014" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="plum" cx="14%" cy="88%" r="68%">
      <stop stop-color="#a15ee8" stop-opacity=".46"/>
      <stop offset=".7" stop-color="#081014" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="52"/></filter>
  </defs>
  <rect width="1920" height="1200" fill="url(#base)"/>
  <rect width="1920" height="1200" fill="url(#mint)"/>
  <rect width="1920" height="1200" fill="url(#plum)"/>
  <path d="M-100 910 C 360 560, 710 800, 1160 400 S 1880 210, 2070 -80"
    fill="none" stroke="#8ff5dc" stroke-opacity=".26" stroke-width="138" filter="url(#blur)"/>
  <g fill="#d7fff4" fill-opacity=".34">
    <circle cx="1430" cy="210" r="3"/><circle cx="1640" cy="360" r="2"/>
    <circle cx="1250" cy="120" r="2"/><circle cx="1780" cy="160" r="3"/>
  </g>
</svg>`;

export const BUILTIN_THEMES: BuiltinThemeSeed[] = [
  {
    manifest: {
      format: "skin-studio-theme-v1",
      schemaVersion: 1,
      id: "aurora-glass",
      name: "Aurora Glass",
      description: "完整界面基准主题：极光背景、深色玻璃、薄荷强调色。",
      author: "Skin Studio",
      builtin: true,
      asset: { file: "background.svg", mime: "image/svg+xml", animated: false },
      presentation: {
        appearance: "dark",
        fit: "cover",
        positionX: 62,
        positionY: 44,
        scale: 1,
        brightness: 0.86,
        overlayOpacity: 0.18,
        panelOpacity: 0.72,
        panelBlur: 20,
        radius: 16,
        accent: "#72e0bd",
        textTone: "light",
        taskIntensity: 0.42,
        colors: {
          background: "#0b1017",
          panel: "#151b24",
          panelAlt: "#202a34",
          accent: "#72e0bd",
          accentAlt: "#a6f4dc",
          secondary: "#6da8ff",
          highlight: "#c48af0",
          text: "#f2f7f5",
          muted: "#a7b6b2",
          line: "#40544f",
        },
      },
      source: { type: "builtin", label: "Skin Studio 内置", adapter: "skin-studio-v1" },
      createdAt: now,
      updatedAt: now,
    },
    svg: auroraSvg,
  },
  {
    manifest: {
      format: "skin-studio-theme-v1",
      schemaVersion: 1,
      id: "medieval-scriptorium",
      name: "文艺复兴工坊",
      description: "文艺复兴暗室、暖象牙正文与铜金强调；背景保持静止，人物以轻量呼吸浮动为主。",
      author: "Skin Studio",
      builtin: true,
      asset: { file: "background.svg", mime: "image/svg+xml", animated: true },
      presentation: {
        appearance: "dark",
        fit: "cover",
        positionX: 53,
        positionY: 48,
        scale: 1,
        brightness: 1,
        overlayOpacity: 0,
        panelOpacity: 0.2,
        panelBlur: 0,
        radius: 12,
        accent: "#d6a151",
        textTone: "light",
        taskIntensity: 1,
        colors: {
          background: "#1e120f",
          panel: "#251812",
          panelAlt: "#382318",
          accent: "#d6a151",
          accentAlt: "#efc578",
          secondary: "#8fa36c",
          highlight: "#c46d56",
          text: "#f8edd5",
          muted: "#c8b99a",
          line: "#8f6a3f",
        },
      },
      safeCss: {
        contract: "dreamskin-safe-css/1",
        css: `[data-ds-part="root"] {
  --ds-theme-font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  font-family: var(--ds-theme-font-family);
  letter-spacing: .01em;
}
[data-ds-part="sidebar"] {
  border-right-color: rgba(115, 77, 41, .38);
}
[data-ds-part="header"] {
  font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
  font-weight: 600;
  letter-spacing: .025em;
  border-bottom-color: rgba(115, 77, 41, .34);
}
[data-ds-part="thread"] {
  box-shadow: inset 0 1px 0 rgba(255, 249, 232, .62);
}
[data-ds-part="message"] {
  line-height: 1.62;
}
[data-ds-part="composer"] {
  box-shadow: 0 16px 42px rgba(58, 34, 19, .22);
}
`,
      },
      source: { type: "builtin", label: "Skin Studio 内置 · 文艺复兴工坊", adapter: "skin-studio-v1" },
      createdAt: now,
      updatedAt: now,
    },
    bundledAsset: "medieval-scriptorium/background.svg",
  },
];

export const ACTIVE_BUILTIN_IDS = new Set(BUILTIN_THEMES.map((item) => item.manifest.id));
