import { describe, expect, it } from "vitest";
import type { ThemeSummary } from "../src/shared/types";
import { DEFAULT_PRESENTATION } from "../src/main/core/theme-utils";
import { buildStudioBackgroundStyle } from "../src/renderer/studio-theme";

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
});
