import { describe, expect, it } from "vitest";
import { DEFAULT_PRESENTATION } from "../src/main/core/theme-utils";
import {
  applyBackgroundVisibility,
  backgroundVisibilityRecipe,
  detachBackgroundVisibilityField,
  restoreBackgroundVisibilityField,
} from "../src/renderer/background-visibility";

describe("background visibility controls", () => {
  it("moves every linked coverage value from one outcome-oriented control", () => {
    expect(applyBackgroundVisibility(DEFAULT_PRESENTATION, 1)).toMatchObject({
      backgroundVisibility: 1,
      overlayOpacity: 0.035,
      panelOpacity: 0.42,
      taskIntensity: 0.9,
      panelBlur: 0,
      composerOpacity: 0.68,
      popupOpacity: 0.76,
    });
  });

  it("keeps a manually detached value when the overall control moves", () => {
    const detached = {
      ...DEFAULT_PRESENTATION,
      panelBlur: 7,
      backgroundVisibilityOverrides: ["panelBlur" as const],
    };
    expect(applyBackgroundVisibility(detached, 0.1).panelBlur).toBeUndefined();
  });

  it("can restore a detailed setting to follow the overall value", () => {
    const detached = {
      ...DEFAULT_PRESENTATION,
      backgroundVisibility: 0.7,
      panelBlur: 6,
      backgroundVisibilityOverrides: ["panelBlur" as const],
    };
    expect(detachBackgroundVisibilityField(DEFAULT_PRESENTATION, "panelBlur", 6))
      .toMatchObject({ panelBlur: 6, backgroundVisibilityOverrides: ["panelBlur"] });
    expect(restoreBackgroundVisibilityField(detached, "panelBlur")).toMatchObject({
      panelBlur: backgroundVisibilityRecipe(0.7).panelBlur,
      backgroundVisibilityOverrides: [],
    });
  });
});
