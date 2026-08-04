import type { CSSProperties } from "react";
import type { TextTone, ThemePresentation, ThemeSummary } from "../shared/types";

type StudioBackgroundStyle = CSSProperties & Record<string, string | number>;
export type StudioMotionStyle = CSSProperties & Record<string, string | number>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

const LIGHT_TEXT = { text: "#fff4dc", muted: "#d5c3a3" } as const;
const DARK_TEXT = { text: "#201b17", muted: "#6b625a" } as const;

function rgb(color: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as [number, number, number];
}

function blend(foreground: string, background: string, alpha: number): string {
  const front = rgb(foreground);
  const back = rgb(background);
  const channels = front.map((value, index) => Math.round(value * alpha + back[index] * (1 - alpha)));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function withAlpha(color: string, alpha: number): string {
  const [red, green, blue] = rgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/** Returns an accessible paired preset for primary and secondary text. */
export function resolveTextToneColors(
  tone: TextTone,
  presentation: Pick<ThemePresentation, "panelOpacity" | "colors">,
): { text: string; muted: string } {
  if (tone === "light") return { ...LIGHT_TEXT };
  if (tone === "dark") return { ...DARK_TEXT };
  const surface = blend(
    presentation.colors.panel,
    presentation.colors.background,
    presentation.panelOpacity,
  );
  return relativeLuminance(surface) >= 0.42 ? { ...DARK_TEXT } : { ...LIGHT_TEXT };
}

function usesLightBackdrop(theme: ThemeSummary): boolean {
  const { appearance, textTone, colors } = theme.presentation;
  if (appearance === "light") return true;
  if (appearance === "dark") return false;
  if (textTone === "dark") return true;
  if (textTone === "light") return false;
  return relativeLuminance(colors.background) >= 0.48;
}

export function displayedBackgroundUrl(theme: ThemeSummary): string {
  return theme.presentation.motionEnabled === false && theme.stillAssetUrl
    ? theme.stillAssetUrl
    : theme.assetUrl;
}

export function buildStudioMotionStyle(
  theme: ThemeSummary | null,
  enabled: boolean,
  viewport: { width: number; height: number },
): StudioMotionStyle | null {
  const motion = theme?.asset.motion;
  if (!theme || !enabled || !theme.motionAssetUrl || !motion || theme.presentation.motionEnabled === false) {
    return null;
  }
  const { width, height } = viewport;
  if (!width || !height) return null;
  const p = theme.presentation;
  let scaleX: number;
  let scaleY: number;
  if (p.fit === "fill") {
    scaleX = width / motion.canvasWidth;
    scaleY = height / motion.canvasHeight;
  } else {
    const scale = p.fit === "contain"
      ? Math.min(width / motion.canvasWidth, height / motion.canvasHeight)
      : Math.max(width / motion.canvasWidth, height / motion.canvasHeight);
    scaleX = scale;
    scaleY = scale;
  }
  const imageWidth = motion.canvasWidth * scaleX;
  const imageHeight = motion.canvasHeight * scaleY;
  const offsetX = (width - imageWidth) * (p.positionX / 100);
  const offsetY = (height - imageHeight) * (p.positionY / 100);
  return {
    left: `${offsetX + motion.cropX * scaleX}px`,
    top: `${offsetY + motion.cropY * scaleY}px`,
    width: `${motion.cropWidth * scaleX}px`,
    height: `${motion.cropHeight * scaleY}px`,
    backgroundImage: `url("${theme.motionAssetUrl}")`,
    transformOrigin: `${(motion.originX - motion.cropX) * scaleX}px ${(motion.originY - motion.cropY) * scaleY}px`,
    "--studio-motion-x-1": `${4 * scaleX}px`,
    "--studio-motion-y-1": `${-5 * scaleY}px`,
    "--studio-motion-x-2": `${-2.5 * scaleX}px`,
    "--studio-motion-y-2": `${2 * scaleY}px`,
    "--studio-motion-x-3": `${2 * scaleX}px`,
    "--studio-motion-y-3": `${1 * scaleY}px`,
  };
}

export function buildStudioBackgroundStyle(
  theme: ThemeSummary | null,
  enabled: boolean,
): StudioBackgroundStyle {
  if (!theme || !enabled) return {};
  const { presentation } = theme;
  const lightBackdrop = usesLightBackdrop(theme);
  const overlayOpacity = Number((lightBackdrop
    ? clamp(presentation.overlayOpacity + 0.06, 0.1, 0.3)
    : clamp(presentation.overlayOpacity + 0.16, 0.26, 0.5)).toFixed(3));
  // Studio is a live preview: use the same blur source as Codex rather than
  // a faint decorative approximation that disappears behind a light veil.
  const backgroundBlur = clamp(presentation.panelBlur, 0, 32);
  const panelOpacity = clamp(presentation.panelOpacity, 0.3, 1);
  return {
    "--studio-bg-color": presentation.colors.background,
    "--studio-bg-image": `url("${displayedBackgroundUrl(theme)}")`,
    "--studio-bg-position": `${presentation.positionX}% ${presentation.positionY}%`,
    "--studio-bg-size": presentation.fit === "fill" ? "100% 100%" : presentation.fit,
    "--studio-bg-brightness": presentation.brightness,
    "--studio-bg-scale": presentation.scale,
    "--studio-bg-overlay-color": lightBackdrop ? presentation.colors.background : "#080b10",
    "--studio-bg-overlay-opacity": overlayOpacity,
    "--studio-bg-blur": `${backgroundBlur.toFixed(1)}px`,
    "--studio-bg-bleed": (backgroundBlur / 320).toFixed(3),
    "--studio-glass-blur": `${backgroundBlur.toFixed(1)}px`,
    "--studio-card-blur": `${(backgroundBlur * 0.42).toFixed(1)}px`,
    "--studio-panel-surface": withAlpha(presentation.colors.panel, panelOpacity),
    "--studio-library-surface": withAlpha(presentation.colors.background, panelOpacity * 0.78),
    "--studio-card-surface": withAlpha(presentation.colors.panelAlt, Math.max(0.22, panelOpacity * 0.42)),
    "--studio-accent": presentation.accent,
    "--studio-theme-panel": presentation.colors.panel,
    "--studio-theme-text": presentation.colors.text,
  };
}
