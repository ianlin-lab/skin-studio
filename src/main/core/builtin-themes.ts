import type { ThemeManifest } from "../../shared/types";

export interface BuiltinThemeSeed {
  manifest: ThemeManifest;
  /** Inline art keeps the tiny starter theme self-contained. */
  svg?: string;
  /** Larger motion art is copied from bundled-themes at first launch. */
  bundledAsset?: string;
  /** Optional transparent moving layer paired with a static bundled background. */
  bundledMotionAsset?: string;
}

const now = "2026-07-31T00:00:00.000Z";

const claudeWarmSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1200" viewBox="0 0 1920 1200">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#faf8f2"/>
      <stop offset=".52" stop-color="#f5f1e8"/>
      <stop offset="1" stop-color="#eee7da"/>
    </linearGradient>
    <radialGradient id="warmth" cx="78%" cy="18%" r="62%">
      <stop offset="0" stop-color="#e7b59f" stop-opacity=".32"/>
      <stop offset=".42" stop-color="#e8cdbd" stop-opacity=".14"/>
      <stop offset="1" stop-color="#f7f4ed" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sage" cx="10%" cy="92%" r="66%">
      <stop offset="0" stop-color="#b9b7a3" stop-opacity=".2"/>
      <stop offset=".58" stop-color="#d8d2c5" stop-opacity=".08"/>
      <stop offset="1" stop-color="#f7f4ed" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="17"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 .022"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="1920" height="1200" fill="url(#paper)"/>
  <rect width="1920" height="1200" fill="url(#warmth)"/>
  <rect width="1920" height="1200" fill="url(#sage)"/>
  <path d="M1320 -120 C 1510 180, 1640 350, 2020 420" fill="none" stroke="#c15f3c" stroke-width="210" stroke-linecap="round" stroke-opacity=".035"/>
  <rect width="1920" height="1200" filter="url(#grain)" opacity=".7"/>
</svg>`;

export const BUILTIN_THEMES: BuiltinThemeSeed[] = [
  {
    manifest: {
      format: "skin-studio-theme-v1",
      schemaVersion: 1,
      id: "claude-warm",
      name: "Claude Warm",
      description: "受 Claude 启发的暖米白界面、陶土橙强调色与克制的纸张质感。",
      author: "Skin Studio",
      builtin: true,
      asset: { file: "background.svg", mime: "image/svg+xml", animated: false },
      presentation: {
        appearance: "light",
        fit: "cover",
        positionX: 62,
        positionY: 44,
        scale: 1,
        brightness: 1.02,
        overlayOpacity: 0.04,
        panelOpacity: 0.94,
        panelBlur: 14,
        radius: 16,
        accent: "#c15f3c",
        textTone: "dark",
        taskIntensity: 0.08,
        colors: {
          background: "#f7f4ed",
          panel: "#eee9df",
          panelAlt: "#fffdf8",
          accent: "#c15f3c",
          accentAlt: "#d97757",
          secondary: "#8b6f60",
          highlight: "#ead7c8",
          text: "#2d2926",
          muted: "#756d66",
          line: "rgba(74, 61, 52, 0.18)",
        },
      },
      source: { type: "builtin", label: "Skin Studio 内置 · Claude Warm", adapter: "skin-studio-v1" },
      createdAt: now,
      updatedAt: now,
    },
    svg: claudeWarmSvg,
  },
];

export const ACTIVE_BUILTIN_IDS = new Set(BUILTIN_THEMES.map((item) => item.manifest.id));
