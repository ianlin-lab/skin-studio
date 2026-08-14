import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ThemeManifest } from "../../shared/types";

export interface InjectionPayload {
  expression: string;
  revision: string;
}

const INJECTION_CONTRACT = "skin-studio-codex-v2";

function hexToRgb(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}

function readableOn(color: string): string {
  const [red, green, blue] = hexToRgb(color).map((value) => value / 255);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.58 ? "#101318" : "#ffffff";
}

export async function buildInjectionPayload(
  theme: ThemeManifest,
  assetPath: string,
): Promise<InjectionPayload> {
  const p = theme.presentation;
  const c = p.colors;
  const useStillArtwork = p.motionEnabled === false && Boolean(theme.asset.still);
  const artwork = useStillArtwork ? theme.asset.still! : theme.asset;
  const artworkPath = useStillArtwork
    ? path.join(path.dirname(assetPath), artwork.file)
    : assetPath;
  const bytes = await fs.readFile(artworkPath);
  const artDataUrl = `data:${artwork.mime};base64,${bytes.toString("base64")}`;
  const motion = theme.asset.motion && p.motionEnabled !== false ? theme.asset.motion : undefined;
  const motionBytes = motion
    ? await fs.readFile(path.join(path.dirname(assetPath), motion.file))
    : undefined;
  const motionDataUrl = motion && motionBytes
    ? `data:${motion.mime};base64,${motionBytes.toString("base64")}`
    : undefined;
  const panelBackdrop = p.panelBlur > 0
    ? `blur(${p.panelBlur}px) saturate(1.08)`
    : "none";
  const softPanelBackdrop = p.panelBlur > 0
    ? `blur(${Math.max(6, p.panelBlur * 0.55)}px)`
    : "none";
  const compactPanelBackdrop = p.panelBlur > 0
    ? `blur(${Math.max(6, p.panelBlur * 0.7)}px)`
    : "none";
  const mainSurfaceAlpha = Math.max(0.08, 0.4 - p.taskIntensity * 0.26);
  const onAccent = readableOn(c.accent);
  const taskPanelAlpha = Math.min(0.98, p.panelOpacity + (1 - p.taskIntensity) * 0.18);
  const composerAlpha = p.composerOpacity ?? Math.min(0.98, p.panelOpacity + 0.13);
  const popupAlpha = p.popupOpacity ?? Math.min(0.99, p.panelOpacity + 0.16);
  const veilAlpha = Math.min(
    0.9,
    p.overlayOpacity + Math.max(0, 1 - p.brightness) * 0.6,
  );
  const artworkVeil = p.appearance === "light"
    ? `rgba(255, 252, 247, ${veilAlpha})`
    : `rgba(5, 8, 13, ${veilAlpha})`;
  const artworkSizeFallback = p.fit === "fill" ? "100% 100%" : p.fit;
  const motionCss = motionDataUrl && motion ? `
html[data-skin-studio-theme] body {
  isolation: isolate !important;
}

html[data-skin-studio-theme] body::before {
  content: "" !important;
  position: fixed !important;
  left: var(--skin-motion-left, -20000px) !important;
  top: var(--skin-motion-top, -20000px) !important;
  width: var(--skin-motion-width, 0px) !important;
  height: var(--skin-motion-height, 0px) !important;
  z-index: 0 !important;
  pointer-events: none !important;
  contain: layout paint style !important;
  background: url(${JSON.stringify(motionDataUrl)}) center / 100% 100% no-repeat !important;
  transform-origin: var(--skin-motion-origin-x, 50%) var(--skin-motion-origin-y, 50%) !important;
  will-change: transform !important;
  animation: skin-studio-person-float 11.8s ease-in-out infinite !important;
}

html[data-skin-studio-theme] #root,
html[data-skin-studio-theme] [data-reactroot] {
  position: relative !important;
  z-index: 1 !important;
}

@keyframes skin-studio-person-float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1, 1); }
  28% { transform: translate3d(var(--skin-motion-x-1), var(--skin-motion-y-1), 0) scale(1.014, 1.022); }
  62% { transform: translate3d(var(--skin-motion-x-2), var(--skin-motion-y-2), 0) scale(1.009, 1.012); }
  82% { transform: translate3d(var(--skin-motion-x-3), var(--skin-motion-y-3), 0) scale(1.012, 1.018); }
}

@media (prefers-reduced-motion: reduce) {
  html[data-skin-studio-theme] body::before { animation: none !important; }
}
` : "";
  const css = `
html[data-skin-studio-theme] {
  --skin-bg: ${c.background};
  --skin-panel: ${c.panel};
  --skin-panel-alt: ${c.panelAlt};
  --skin-accent: ${c.accent};
  --skin-accent-alt: ${c.accentAlt};
  --skin-secondary: ${c.secondary};
  --skin-highlight: ${c.highlight};
  --skin-text: ${c.text};
  --skin-muted: ${c.muted};
  --skin-line: ${c.line};
  --skin-on-accent: ${onAccent};
  --skin-radius: ${p.radius}px;
  --skin-blur: ${p.panelBlur}px;
  --ds-theme-color-background: ${c.background};
  --ds-theme-color-panel: ${c.panel};
  --ds-theme-color-panel-alt: ${c.panelAlt};
  --ds-theme-color-accent: ${c.accent};
  --ds-theme-color-accent-alt: ${c.accentAlt};
  --ds-theme-color-secondary: ${c.secondary};
  --ds-theme-color-highlight: ${c.highlight};
  --ds-theme-color-text: ${c.text};
  --ds-theme-color-muted: ${c.muted};
  --ds-theme-color-line: ${c.line};
  --ds-theme-surface-opacity: ${p.panelOpacity};
  --ds-theme-surface-blur: ${p.panelBlur}px;
  --ds-theme-surface-radius: ${p.radius}px;
  --ds-theme-surface-border-alpha: .22;
  --ds-theme-surface-shadow: 0 18px 48px ${rgba(c.background, 0.28)};
  --ds-theme-image-focus-x: ${p.positionX}%;
  --ds-theme-image-focus-y: ${p.positionY}%;
  --ds-theme-image-zoom: ${p.scale};
  --ds-theme-image-dim: ${p.overlayOpacity};
  --ds-theme-image-task-intensity: ${p.taskIntensity};
  --ds-theme-font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --ds-theme-font-scale: 1;
  --ds-theme-density-scale: standard;
  --ds-theme-motion-level: standard;
  --color-token-main-surface-primary: transparent;
  --color-background-surface: ${c.background};
  --color-background-surface-under: ${c.background};
  --codex-base-surface: ${c.background};
  --color-token-foreground: ${c.text};
  --color-token-text-primary: ${c.text};
  --color-token-text-secondary: ${c.muted};
  --color-token-text-tertiary: ${c.muted};
  --color-text-foreground: ${c.text};
  --color-text-foreground-secondary: ${c.muted};
  --color-text-foreground-tertiary: ${c.muted};
  --color-token-description-foreground: ${c.muted};
  --color-token-disabled-foreground: ${c.muted};
  --color-token-input-foreground: ${c.text};
  --color-token-input-placeholder-foreground: ${c.muted};
  --color-token-input-background: ${rgba(c.panelAlt, composerAlpha)};
  --color-token-side-bar-background: ${rgba(c.panel, Math.min(0.98, p.panelOpacity + 0.08))};
  --color-token-sidebar-surface-primary: ${rgba(c.panel, Math.min(0.98, p.panelOpacity + 0.08))};
  --color-token-button-background: ${c.accent};
  --color-token-button-foreground: ${c.panelAlt};
  --color-token-dropdown-background: ${rgba(c.panel, popupAlpha)};
  --color-token-dropdown-foreground: ${c.text};
  --color-token-border: ${c.line};
  --color-token-border-default: ${c.line};
  --color-token-border-light: ${c.line};
  --color-token-border-heavy: ${c.line};
  --color-border: ${c.line};
  --color-border-light: ${c.line};
  --color-border-heavy: ${c.line};
  --color-border-focus: ${c.accent};
  --color-token-focus-border: ${c.accent};
  --color-token-text-link-foreground: ${c.accent};
  --color-token-text-link-active-foreground: ${c.accentAlt};
  --vscode-foreground: ${c.text};
  --vscode-editor-foreground: ${c.text};
  --vscode-input-foreground: ${c.text};
  --vscode-input-background: ${rgba(c.panelAlt, composerAlpha)};
  --vscode-dropdown-foreground: ${c.text};
  --vscode-dropdown-background: ${rgba(c.panel, popupAlpha)};
  --vscode-sideBar-foreground: ${c.text};
  --vscode-sideBar-background: ${rgba(c.panel, Math.min(0.98, p.panelOpacity + 0.08))};
  --vscode-sideBar-border: ${c.line};
  --vscode-button-background: ${c.accent};
  --vscode-button-foreground: ${onAccent};
  --vscode-button-hoverBackground: ${c.accentAlt};
  --vscode-textLink-foreground: ${c.accent};
  --vscode-focusBorder: ${c.accent};
  background-color: var(--skin-bg) !important;
}

html[data-skin-studio-theme] body {
  min-height: 100vh !important;
  font-family: var(--ds-theme-font-family) !important;
  color: var(--skin-text) !important;
  background-color: var(--skin-bg) !important;
  background-image:
    linear-gradient(${artworkVeil}, ${artworkVeil}),
    url(${JSON.stringify(artDataUrl)}) !important;
  background-position: center, ${p.positionX}% ${p.positionY}% !important;
  background-size: 100% 100%, var(--skin-artwork-size, ${artworkSizeFallback}) !important;
  background-repeat: no-repeat !important;
  background-attachment: scroll !important;
}

html[data-skin-studio-theme] #root,
html[data-skin-studio-theme] [data-reactroot] {
  /* Keep title-bar and other native controls out of the web theme's color-scheme. */
  color-scheme: ${p.appearance === "light" ? "light" : "dark"} !important;
  color: var(--skin-text) !important;
  background: transparent !important;
}

html[data-skin-studio-theme] main.main-surface,
html[data-skin-studio-theme] main[data-app-shell-main-surface],
html[data-skin-studio-theme] main.bg-token-main-surface-primary {
  position: relative !important;
  isolation: isolate !important;
  color: var(--skin-text) !important;
  background-color: ${rgba(c.background, mainSurfaceAlpha)} !important;
  background-image: none !important;
  border-color: var(--skin-line) !important;
}

html[data-skin-studio-theme] aside.app-shell-left-panel {
  color: var(--skin-text) !important;
  background: ${rgba(c.panel, p.panelOpacity)} !important;
  border-color: var(--skin-line) !important;
  backdrop-filter: ${panelBackdrop} !important;
}

html[data-skin-studio-theme] header.app-header-tint,
html[data-skin-studio-theme] [data-app-shell-main-surface] > header,
html[data-skin-studio-theme] header[data-app-shell-application-menu-bar],
html[data-skin-studio-theme] [data-ds-part="header"] {
  color: var(--skin-text) !important;
  background: ${rgba(c.panel, Math.min(0.94, p.panelOpacity + 0.04))} !important;
  border-color: var(--skin-line) !important;
  backdrop-filter: ${panelBackdrop} !important;
}

/* Codex keeps some header context controls on a light native surface. They must
   not inherit the theme's light foreground, or labels such as “打开位置” disappear. */
html[data-skin-studio-theme] [data-ds-part="header"] button[class~="bg-token-bg-fog"] {
  color: #22252e !important;
}

html[data-skin-studio-theme] [role="main"],
html[data-skin-studio-theme] [data-ds-part="home"] {
  color: var(--skin-text) !important;
  background: transparent !important;
}

html[data-skin-studio-theme] .thread-scroll-container,
html[data-skin-studio-theme] [data-ds-part="thread"] {
  color: var(--skin-text) !important;
  background: ${rgba(c.background, taskPanelAlpha)} !important;
  backdrop-filter: ${softPanelBackdrop} !important;
}

html[data-skin-studio-theme] .composer-surface-chrome,
html[data-skin-studio-theme] [data-ds-part="composer"] {
  color: var(--skin-text) !important;
  caret-color: var(--skin-accent) !important;
  background-color: ${rgba(c.panelAlt, composerAlpha)} !important;
  border: 1px solid var(--skin-line) !important;
  border-radius: var(--skin-radius) !important;
  backdrop-filter: ${panelBackdrop} !important;
  box-shadow: 0 16px 46px ${rgba(c.background, 0.25)} !important;
}

html[data-skin-studio-theme] .composer-surface-chrome :is(input, textarea, [contenteditable="true"]),
html[data-skin-studio-theme] [data-ds-part="composer"] :is(input, textarea, [contenteditable="true"]) {
  color: var(--skin-text) !important;
  caret-color: var(--skin-accent) !important;
}

html[data-skin-studio-theme] :is(input, textarea)::placeholder,
html[data-skin-studio-theme] .composer-surface-chrome .placeholder,
html[data-skin-studio-theme] [class*="text-token-input-placeholder"] {
  color: var(--skin-muted) !important;
  opacity: .82 !important;
}

html[data-skin-studio-theme] :is([role="dialog"], [role="menu"]),
html[data-skin-studio-theme] [data-radix-popper-content-wrapper] > *,
html[data-skin-studio-theme] [data-ds-part="dialog"] {
  color: var(--skin-text) !important;
  background-color: ${rgba(c.panel, popupAlpha)} !important;
  border-color: var(--skin-line) !important;
  border-radius: var(--skin-radius) !important;
  backdrop-filter: blur(var(--skin-blur)) saturate(1.08) !important;
  box-shadow: 0 20px 54px ${rgba(c.background, 0.34)} !important;
}

html[data-skin-studio-theme] .group\\/home-suggestions button,
html[data-skin-studio-theme] .group\\/project-selector > button,
html[data-skin-studio-theme] [data-ds-part="project-list"] {
  color: var(--skin-text) !important;
  background-color: ${rgba(c.panel, Math.max(0.48, p.panelOpacity - 0.08))} !important;
  border-color: var(--skin-line) !important;
  border-radius: var(--skin-radius) !important;
  backdrop-filter: ${compactPanelBackdrop} !important;
  box-shadow: 0 10px 28px ${rgba(c.background, 0.18)} !important;
}

html[data-skin-studio-theme] :is(
  [class~="text-token-text-primary"],
  [class~="text-token-foreground"],
  [class~="text-token-foreground-primary"]
) {
  color: var(--skin-text) !important;
}

html[data-skin-studio-theme] :is(
  [class~="text-token-text-secondary"],
  [class~="text-token-muted-foreground"],
  [class~="text-token-description-foreground"],
  .text-secondary,
  .text-tertiary,
  [class*="text-muted"]
) {
  color: var(--skin-muted) !important;
}

/* Some Codex settings cards intentionally keep a light native surface. Preserve their contrast
   instead of forcing the theme's light reading colors into white panels. */
html[data-skin-studio-theme] [data-skin-studio-light-surface] {
  --skin-text: #332820;
  --skin-muted: #6d5a4a;
  --color-token-foreground: #332820;
  --color-token-text-primary: #332820;
  --color-token-text-secondary: #6d5a4a;
  --color-token-text-tertiary: #6d5a4a;
  --color-text-foreground: #332820;
  --color-text-foreground-secondary: #6d5a4a;
  --color-text-foreground-tertiary: #6d5a4a;
  --color-token-description-foreground: #6d5a4a;
  --color-token-input-foreground: #332820;
  --vscode-foreground: #332820;
  --vscode-editor-foreground: #332820;
  --vscode-input-foreground: #332820;
  color: #332820 !important;
}

html[data-skin-studio-theme] [data-skin-studio-light-surface] :is(
  [class~="text-token-text-primary"],
  [class~="text-token-foreground"],
  [class~="text-token-foreground-primary"],
  label,
  input,
  select,
  textarea
) {
  color: #332820 !important;
}

html[data-skin-studio-theme] [data-skin-studio-light-surface] :is(
  [class~="text-token-text-secondary"],
  [class~="text-token-muted-foreground"],
  [class~="text-token-description-foreground"],
  .text-secondary,
  .text-tertiary,
  [class*="text-muted"]
) {
  color: #6d5a4a !important;
}

html[data-skin-studio-theme] aside.app-shell-left-panel :is(button, a) {
  color: var(--skin-muted) !important;
  border-color: transparent !important;
}

html[data-skin-studio-theme] aside.app-shell-left-panel :is(button, a):hover {
  color: var(--skin-text) !important;
  background-color: ${rgba(c.accent, 0.12)} !important;
}

html[data-skin-studio-theme] aside.app-shell-left-panel :is(svg, [class*="icon"]) {
  color: currentColor !important;
}

html[data-skin-studio-theme] :is(button, a, [role="button"]):focus-visible {
  outline: 2px solid var(--skin-accent) !important;
  outline-offset: 2px !important;
}

html[data-skin-studio-theme] button[class~="bg-token-foreground"],
html[data-skin-studio-theme] :is(button, [role="button"])[data-variant="primary"] {
  color: var(--skin-on-accent) !important;
  background: var(--skin-accent) !important;
  border-color: var(--skin-accent-alt) !important;
  box-shadow: 0 8px 22px ${rgba(c.accent, 0.24)} !important;
}

html[data-skin-studio-theme] button[class~="bg-token-foreground"]:hover,
html[data-skin-studio-theme] :is(button, [role="button"])[data-variant="primary"]:hover {
  background: var(--skin-accent-alt) !important;
}

html[data-skin-studio-theme] :is(
  [aria-selected="true"],
  [aria-current="page"],
  [data-state="checked"]:not([role="switch"]):not([role="switch"] *),
  [data-state="active"]
) {
  color: var(--skin-text) !important;
  border-color: ${rgba(c.accent, 0.46)} !important;
  background-color: ${rgba(c.accent, 0.17)} !important;
}

html[data-skin-studio-theme] [role="switch"] {
  color: var(--skin-text) !important;
  border-color: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

html[data-skin-studio-theme] [role="switch"] > [data-state] {
  border: 1px solid ${rgba(c.muted, 0.32)} !important;
  background-color: ${rgba(c.muted, 0.24)} !important;
  box-shadow: inset 0 0 0 1px ${rgba(c.panel, 0.18)} !important;
}

html[data-skin-studio-theme] [role="switch"] > [data-state="checked"] {
  border-color: var(--skin-accent-alt) !important;
  background-color: var(--skin-accent) !important;
}

html[data-skin-studio-theme] [role="switch"] > [data-state] > [data-state] {
  border-color: ${rgba(c.muted, 0.42)} !important;
  background-color: var(--skin-on-accent) !important;
  box-shadow: 0 1px 3px ${rgba(c.text, 0.24)} !important;
}

html[data-skin-studio-theme] :is(a, [data-link], .text-accent-foreground) {
  color: var(--skin-accent) !important;
}

html[data-skin-studio-theme] [data-message-author-role="user"] > *,
html[data-skin-studio-theme] [data-ds-part="message"][data-message-author-role="user"] > * {
  color: var(--skin-text) !important;
  background-color: ${rgba(c.panelAlt, Math.min(0.95, p.panelOpacity + 0.08))} !important;
  border-color: ${rgba(c.accent, 0.28)} !important;
  border-radius: var(--skin-radius) !important;
}

html[data-skin-studio-theme] :is(pre, code, [class*="_markdown"]) {
  border-color: var(--skin-line) !important;
}

html[data-skin-studio-theme] pre {
  background-color: ${rgba(c.panel, Math.min(0.98, p.panelOpacity + 0.18))} !important;
}

html[data-skin-studio-theme] [class~="bg-token-dropdown-background"],
html[data-skin-studio-theme] [class~="bg-token-main-surface-secondary"],
html[data-skin-studio-theme] [class~="bg-token-sidebar-surface-primary"] {
  color: var(--skin-text) !important;
  background-color: ${rgba(c.panel, popupAlpha)} !important;
}

${motionCss}

${theme.safeCss?.css ?? ""}
`;

  const revision = crypto
    .createHash("sha256")
    .update(INJECTION_CONTRACT)
    .update(JSON.stringify(theme))
    .update(css)
    .update(bytes)
    .update(motionBytes ?? Buffer.alloc(0))
    .digest("hex")
    .slice(0, 18);
  const expression = `(() => {
    const stateKey = "__SKIN_STUDIO_THEME_STATE__";
    const styleId = "skin-studio-theme-style";
    const partAttribute = "data-ds-part";
    const previous = window[stateKey];
    if (typeof previous?.cleanup === "function") previous.cleanup();
    const root = document.documentElement;
    const style = document.createElement("style");
    style.id = styleId;
    style.dataset.revision = ${JSON.stringify(revision)};
    style.dataset.contract = ${JSON.stringify(INJECTION_CONTRACT)};
    style.textContent = ${JSON.stringify(css)};
    (document.head || root).appendChild(style);
    root.setAttribute("data-skin-studio-theme", ${JSON.stringify(theme.id)});
    root.setAttribute("data-skin-studio-revision", ${JSON.stringify(revision)});
    const partNodes = new Set();
    const lightSurfaceNodes = new Set();
    const mark = (selector, part) => {
      for (const node of document.querySelectorAll(selector)) {
        if (!(node instanceof Element)) continue;
        node.setAttribute(partAttribute, part);
        partNodes.add(node);
      }
    };
    const refresh = () => {
      if (!document.getElementById(styleId)) (document.head || root).appendChild(style);
      root.setAttribute("data-skin-studio-theme", ${JSON.stringify(theme.id)});
      root.setAttribute("data-skin-studio-revision", ${JSON.stringify(revision)});
      root.setAttribute(partAttribute, "root");
      partNodes.add(root);
      mark("aside.app-shell-left-panel", "sidebar");
      mark('main.main-surface, main[data-app-shell-main-surface], main.bg-token-main-surface-primary', "main");
      mark('header.app-header-tint, [data-app-shell-main-surface] > header, header[data-app-shell-application-menu-bar]', "header");
      mark('[role="main"]:has([data-testid="home-icon"])', "home");
      mark('[data-feature="game-source"]', "home-hero");
      mark(".group\\\\/project-selector", "project-list");
      mark(".thread-scroll-container", "thread");
      mark("[data-message-author-role]", "message");
      mark(".composer-surface-chrome", "composer");
      mark('.composer-surface-chrome [class*="_footer_"]', "composer-toolbar");
      mark('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper] > *', "dialog");
      const isOpaqueLightSurface = (node) => {
        const match = getComputedStyle(node).backgroundColor.match(/rgba?\\(([^)]+)\\)/);
        if (!match) return false;
        const channels = match[1].split(",").map((value) => Number.parseFloat(value.trim()));
        const [red, green, blue, alpha = 1] = channels;
        if (![red, green, blue, alpha].every(Number.isFinite) || alpha < .72) return false;
        const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        return luminance > .7;
      };
      for (const node of document.querySelectorAll(':is([role="dialog"], [role="menu"], [class*="settings"], [class*="setting"], [class*="card"], [class*="surface"], [class*="popover"])')) {
        if (!(node instanceof HTMLElement) || !isOpaqueLightSurface(node)) continue;
        node.setAttribute("data-skin-studio-light-surface", "");
        lightSurfaceNodes.add(node);
      }
    };
    let refreshTimer = null;
    const schedule = () => {
      if (refreshTimer !== null) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, 60);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    const artworkScale = ${JSON.stringify(p.scale)};
    let artworkNaturalWidth = 0;
    let artworkNaturalHeight = 0;
    const updateArtworkLayout = () => {
      const width = window.innerWidth || root.clientWidth;
      const height = window.innerHeight || root.clientHeight;
      if (!width || !height || !artworkNaturalWidth || !artworkNaturalHeight) return;
      let scaleX;
      let scaleY;
      if (${JSON.stringify(p.fit)} === "fill") {
        scaleX = (width / artworkNaturalWidth) * artworkScale;
        scaleY = (height / artworkNaturalHeight) * artworkScale;
      } else {
        const fitScale = ${JSON.stringify(p.fit)} === "contain"
          ? Math.min(width / artworkNaturalWidth, height / artworkNaturalHeight)
          : Math.max(width / artworkNaturalWidth, height / artworkNaturalHeight);
        scaleX = fitScale * artworkScale;
        scaleY = fitScale * artworkScale;
      }
      root.style.setProperty(
        "--skin-artwork-size",
        String(Math.round(artworkNaturalWidth * scaleX)) + "px " + String(Math.round(artworkNaturalHeight * scaleY)) + "px",
      );
    };
    const artworkProbe = new Image();
    artworkProbe.addEventListener("load", () => {
      artworkNaturalWidth = artworkProbe.naturalWidth;
      artworkNaturalHeight = artworkProbe.naturalHeight;
      updateArtworkLayout();
    }, { once: true });
    artworkProbe.src = ${JSON.stringify(artDataUrl)};
    window.addEventListener("resize", updateArtworkLayout, { passive: true });
    const motion = ${JSON.stringify(motion ?? null)};
    const updateMotionLayout = () => {
      if (!motion) return;
      const width = window.innerWidth || root.clientWidth;
      const height = window.innerHeight || root.clientHeight;
      if (!width || !height) return;
      let scaleX;
      let scaleY;
      if (${JSON.stringify(p.fit)} === "fill") {
        scaleX = (width / motion.canvasWidth) * artworkScale;
        scaleY = (height / motion.canvasHeight) * artworkScale;
      } else {
        const fitScale = ${JSON.stringify(p.fit)} === "contain"
          ? Math.min(width / motion.canvasWidth, height / motion.canvasHeight)
          : Math.max(width / motion.canvasWidth, height / motion.canvasHeight);
        scaleX = fitScale * artworkScale;
        scaleY = fitScale * artworkScale;
      }
      const imageWidth = motion.canvasWidth * scaleX;
      const imageHeight = motion.canvasHeight * scaleY;
      const offsetX = (width - imageWidth) * ${p.positionX / 100};
      const offsetY = (height - imageHeight) * ${p.positionY / 100};
      root.style.setProperty("--skin-motion-left", String(offsetX + motion.cropX * scaleX) + "px");
      root.style.setProperty("--skin-motion-top", String(offsetY + motion.cropY * scaleY) + "px");
      root.style.setProperty("--skin-motion-width", String(motion.cropWidth * scaleX) + "px");
      root.style.setProperty("--skin-motion-height", String(motion.cropHeight * scaleY) + "px");
      root.style.setProperty("--skin-motion-origin-x", String((motion.originX - motion.cropX) * scaleX) + "px");
      root.style.setProperty("--skin-motion-origin-y", String((motion.originY - motion.cropY) * scaleY) + "px");
      root.style.setProperty("--skin-motion-x-1", String(4 * scaleX) + "px");
      root.style.setProperty("--skin-motion-y-1", String(-5 * scaleY) + "px");
      root.style.setProperty("--skin-motion-x-2", String(-2.5 * scaleX) + "px");
      root.style.setProperty("--skin-motion-y-2", String(2 * scaleY) + "px");
      root.style.setProperty("--skin-motion-x-3", String(2 * scaleX) + "px");
      root.style.setProperty("--skin-motion-y-3", String(1 * scaleY) + "px");
    };
    if (motion) {
      updateMotionLayout();
      window.addEventListener("resize", updateMotionLayout, { passive: true });
    }
    refresh();
    const cleanup = () => {
      observer.disconnect();
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      window.removeEventListener("resize", updateArtworkLayout);
      artworkProbe.src = "";
      root.style.removeProperty("--skin-artwork-size");
      if (motion) {
        window.removeEventListener("resize", updateMotionLayout);
        [
          "--skin-motion-left", "--skin-motion-top", "--skin-motion-width", "--skin-motion-height",
          "--skin-motion-origin-x", "--skin-motion-origin-y", "--skin-motion-x-1", "--skin-motion-y-1",
          "--skin-motion-x-2", "--skin-motion-y-2", "--skin-motion-x-3", "--skin-motion-y-3",
        ].forEach((property) => root.style.removeProperty(property));
      }
      document.getElementById(styleId)?.remove();
      for (const node of partNodes) node.removeAttribute?.(partAttribute);
      document.querySelectorAll("[" + partAttribute + "]").forEach((node) => node.removeAttribute(partAttribute));
      for (const node of lightSurfaceNodes) node.removeAttribute?.("data-skin-studio-light-surface");
      document.querySelectorAll("[data-skin-studio-light-surface]")
        .forEach((node) => node.removeAttribute("data-skin-studio-light-surface"));
      root.removeAttribute("data-skin-studio-theme");
      root.removeAttribute("data-skin-studio-revision");
      if (window[stateKey]?.cleanup === cleanup) delete window[stateKey];
    };
    window[stateKey] = {
      themeId: ${JSON.stringify(theme.id)},
      revision: ${JSON.stringify(revision)},
      refresh,
      cleanup
    };
    const main = document.querySelector('main[data-app-shell-main-surface], main.main-surface, main.bg-token-main-surface-primary');
    const sidebar = document.querySelector("aside.app-shell-left-panel");
    return {
      ok: Boolean(main && sidebar),
      themeId: ${JSON.stringify(theme.id)},
      revision: ${JSON.stringify(revision)},
      markers: {
        main: Boolean(main),
        sidebar: Boolean(sidebar),
        composer: Boolean(document.querySelector(".composer-surface-chrome"))
      }
    };
  })()`;
  return { expression, revision };
}

export const CLEANUP_EXPRESSION = `(() => {
  const state = window.__SKIN_STUDIO_THEME_STATE__;
  if (typeof state?.cleanup === "function") state.cleanup();
  document.getElementById("skin-studio-theme-style")?.remove();
  document.querySelectorAll("[data-ds-part]").forEach((node) => node.removeAttribute("data-ds-part"));
  document.documentElement.removeAttribute("data-skin-studio-theme");
  document.documentElement.removeAttribute("data-skin-studio-revision");
  delete window.__SKIN_STUDIO_THEME_STATE__;
  return { ok: true, stock: true };
})()`;

export function verifyExpression(themeId: string, revision: string): string {
  return `(() => {
    const root = document.documentElement;
    const main = document.querySelector('main[data-app-shell-main-surface], main.main-surface, main.bg-token-main-surface-primary');
    const sidebar = document.querySelector("aside.app-shell-left-panel");
    const style = document.getElementById("skin-studio-theme-style");
    const visualReady = Boolean(
      main
      && sidebar
      && style?.isConnected
    );
    return {
      ok: root.getAttribute("data-skin-studio-theme") === ${JSON.stringify(themeId)}
        && root.getAttribute("data-skin-studio-revision") === ${JSON.stringify(revision)}
        && style?.dataset.revision === ${JSON.stringify(revision)}
        && style?.dataset.contract === ${JSON.stringify(INJECTION_CONTRACT)}
        && visualReady,
      visualReady,
      themeId: root.getAttribute("data-skin-studio-theme"),
      revision: root.getAttribute("data-skin-studio-revision")
    };
  })()`;
}
