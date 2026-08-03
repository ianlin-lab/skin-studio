import type { BackgroundVisibilityOverride, ThemePresentation } from "../shared/types";

export const BACKGROUND_VISIBILITY_KEYS: readonly BackgroundVisibilityOverride[] = [
  "overlayOpacity",
  "panelOpacity",
  "taskIntensity",
  "panelBlur",
  "composerOpacity",
  "popupOpacity",
];

export type BackgroundVisibilityRecipe = Pick<
  ThemePresentation,
  "overlayOpacity" | "panelOpacity" | "taskIntensity" | "panelBlur" | "composerOpacity" | "popupOpacity"
>;

export function clampVisibility(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 0 is reading-first, 1 gives the artwork priority. These values intentionally
 * retain a readable floor for the composer and temporary menus.
 */
export function backgroundVisibilityRecipe(value: number): BackgroundVisibilityRecipe {
  const visibility = clampVisibility(value);
  const lerp = (from: number, to: number) => from + (to - from) * visibility;
  return {
    overlayOpacity: Number(lerp(0.3, 0.035).toFixed(3)),
    panelOpacity: Number(lerp(0.9, 0.42).toFixed(3)),
    taskIntensity: Number(lerp(0.12, 0.9).toFixed(3)),
    panelBlur: Math.round(lerp(18, 0)),
    composerOpacity: Number(lerp(0.94, 0.68).toFixed(3)),
    popupOpacity: Number(lerp(0.96, 0.76).toFixed(3)),
  };
}

export function effectiveBackgroundVisibility(presentation: ThemePresentation): number {
  if (typeof presentation.backgroundVisibility === "number") {
    return clampVisibility(presentation.backgroundVisibility);
  }
  const panelSignal = clampVisibility((0.9 - presentation.panelOpacity) / 0.48);
  const taskSignal = clampVisibility((presentation.taskIntensity - 0.12) / 0.78);
  const blurSignal = clampVisibility((18 - presentation.panelBlur) / 18);
  return Number((panelSignal * 0.42 + taskSignal * 0.42 + blurSignal * 0.16).toFixed(3));
}

export function applyBackgroundVisibility(
  presentation: ThemePresentation,
  value: number,
): Partial<ThemePresentation> {
  const recipe = backgroundVisibilityRecipe(value);
  const detached = new Set(presentation.backgroundVisibilityOverrides ?? []);
  const patch: Partial<ThemePresentation> = { backgroundVisibility: clampVisibility(value) };
  for (const key of BACKGROUND_VISIBILITY_KEYS) {
    if (!detached.has(key)) patch[key] = recipe[key];
  }
  return patch;
}

export function detachBackgroundVisibilityField(
  presentation: ThemePresentation,
  key: BackgroundVisibilityOverride,
  value: number,
): Partial<ThemePresentation> {
  const detached = new Set(presentation.backgroundVisibilityOverrides ?? []);
  detached.add(key);
  return { [key]: value, backgroundVisibilityOverrides: Array.from(detached) };
}

export function restoreBackgroundVisibilityField(
  presentation: ThemePresentation,
  key: BackgroundVisibilityOverride,
): Partial<ThemePresentation> {
  const detached = new Set(presentation.backgroundVisibilityOverrides ?? []);
  detached.delete(key);
  const visibility = effectiveBackgroundVisibility(presentation);
  return {
    [key]: backgroundVisibilityRecipe(visibility)[key],
    backgroundVisibility: visibility,
    backgroundVisibilityOverrides: Array.from(detached),
  };
}
