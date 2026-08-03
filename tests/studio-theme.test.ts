import { describe, expect, it } from "vitest";
import type { ThemeSummary } from "../src/shared/types";
import { DEFAULT_PRESENTATION } from "../src/main/core/theme-utils";
import {
  buildStudioBackgroundStyle,
  buildStudioMotionStyle,
  displayedBackgroundUrl,
  resolveTextToneColors,
} from "../src/renderer/studio-theme";

function theme(overrides: Partial<ThemeSummary["presentation"]>): ThemeSummary {
  return {
    format: "skin-studio-theme-v1",
    schemaVersion: 1,
    id: "studio-background-test",
    name: "Studio Background Test",
    description: "test",
    author: "test",
    builtin: false,
    asset: { file: "background.svg", mime: "image/svg+xml", animated: false },
    presentation: {
      ...DEFAULT_PRESENTATION,
      ...overrides,
      colors: {
        ...DEFAULT_PRESENTATION.colors,
        ...overrides.colors,
      },
    },
    source: { type: "image", label: "test" },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    assetUrl: "skin-studio://asset/studio-background-test",
  };
}

describe("Studio background theme mapping", () => {
  it("uses a light theme color as the veil instead of forcing a black overlay", () => {
    const style = buildStudioBackgroundStyle(theme({
      appearance: "light",
      overlayOpacity: 0.04,
      panelBlur: 14,
      colors: {
        ...DEFAULT_PRESENTATION.colors,
        background: "#f7f4ed",
      },
    }), true);
    expect(style["--studio-bg-color"]).toBe("#f7f4ed");
    expect(style["--studio-bg-overlay-color"]).toBe("#f7f4ed");
    expect(style["--studio-bg-overlay-opacity"]).toBe(0.1);
    expect(style["--studio-bg-blur"]).toBe("6.3px");
  });

  it("keeps a bounded dark readability veil for dark themes", () => {
    const style = buildStudioBackgroundStyle(theme({
      appearance: "dark",
      overlayOpacity: 0.18,
      panelBlur: 20,
    }), true);
    expect(style["--studio-bg-overlay-color"]).toBe("#080b10");
    expect(style["--studio-bg-overlay-opacity"]).toBe(0.34);
    expect(style["--studio-bg-blur"]).toBe("9.0px");
  });

  it("returns no theme variables when Studio follow mode is disabled", () => {
    expect(buildStudioBackgroundStyle(theme({}), false)).toEqual({});
  });

  it("uses the static fallback in Studio when background motion is disabled", () => {
    const dynamicTheme = {
      ...theme({ motionEnabled: false }),
      asset: {
        file: "background.gif",
        mime: "image/gif",
        animated: true,
        still: { file: "background-still.png", mime: "image/png" },
      },
      stillAssetUrl: "skin-studio://asset/studio-background-test?variant=still",
    } satisfies ThemeSummary;
    expect(displayedBackgroundUrl(dynamicTheme)).toBe(dynamicTheme.stillAssetUrl);
    expect(buildStudioBackgroundStyle(dynamicTheme, true)["--studio-bg-image"])
      .toContain("variant=still");
  });

  it("builds a synchronized local motion layer only while Studio follow mode and motion are enabled", () => {
    const dynamicTheme = {
      ...theme({ motionEnabled: true }),
      asset: {
        file: "background.png",
        mime: "image/png",
        animated: true,
        motion: {
          file: "person.png",
          mime: "image/png",
          canvasWidth: 1000,
          canvasHeight: 700,
          cropX: 300,
          cropY: 100,
          cropWidth: 600,
          cropHeight: 600,
          originX: 500,
          originY: 620,
        },
      },
      motionAssetUrl: "skin-studio://asset/studio-background-test?variant=motion",
    } satisfies ThemeSummary;
    expect(buildStudioMotionStyle(dynamicTheme, true, { width: 1200, height: 800 })?.backgroundImage)
      .toContain("variant=motion");
    expect(buildStudioMotionStyle(dynamicTheme, false, { width: 1200, height: 800 })).toBeNull();
    expect(buildStudioMotionStyle({
      ...dynamicTheme,
      presentation: { ...dynamicTheme.presentation, motionEnabled: false },
    }, true, { width: 1200, height: 800 })).toBeNull();
  });

  it("turns the light and dark text choices into real paired colors", () => {
    const presentation = theme({}).presentation;
    expect(resolveTextToneColors("light", presentation)).toEqual({
      text: "#fff4dc",
      muted: "#d5c3a3",
    });
    expect(resolveTextToneColors("dark", presentation)).toEqual({
      text: "#201b17",
      muted: "#6b625a",
    });
  });

  it("automatically chooses text colors from the blended panel surface", () => {
    expect(resolveTextToneColors("auto", theme({
      panelOpacity: 0.9,
      colors: { ...DEFAULT_PRESENTATION.colors, background: "#f7f4ed", panel: "#fffdf8" },
    }).presentation).text).toBe("#201b17");
    expect(resolveTextToneColors("auto", theme({
      panelOpacity: 0.7,
      colors: { ...DEFAULT_PRESENTATION.colors, background: "#100d0b", panel: "#251812" },
    }).presentation).text).toBe("#fff4dc");
  });
});
