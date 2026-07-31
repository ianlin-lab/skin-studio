import type { CSSProperties } from "react";
import type { ThemeSummary } from "../shared/types";

type StudioBackgroundStyle = CSSProperties & Record<string, string | number>;

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

function usesLightBackdrop(theme: ThemeSummary): boolean {
  const { appearance, textTone, colors } = theme.presentation;
  if (appearance === "light") return true;
  if (appearance === "dark") return false;
  if (textTone === "dark") return true;
  if (textTone === "light") return false;
  return relativeLuminance(colors.background) >= 0.48;
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
  const backgroundBlur = clamp(presentation.panelBlur * 0.45, 0, 14);
  return {
    "--studio-bg-color": presentation.colors.background,
    "--studio-bg-image": `url("${theme.assetUrl}")`,
    "--studio-bg-position": `${presentation.positionX}% ${presentation.positionY}%`,
    "--studio-bg-size": presentation.fit === "fill" ? "100% 100%" : presentation.fit,
    "--studio-bg-brightness": presentation.brightness,
    "--studio-bg-scale": presentation.scale,
    "--studio-bg-overlay-color": lightBackdrop ? presentation.colors.background : "#080b10",
    "--studio-bg-overlay-opacity": overlayOpacity,
    "--studio-bg-blur": `${backgroundBlur.toFixed(1)}px`,
    "--studio-accent": presentation.accent,
    "--studio-theme-panel": presentation.colors.panel,
    "--studio-theme-text": presentation.colors.text,
  };
}
