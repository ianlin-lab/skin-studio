import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBundledThemesDirectory } from "../src/main/core/runtime-paths";

describe("resolveBundledThemesDirectory", () => {
  it("uses the project root while running from compiled development output", () => {
    expect(resolveBundledThemesDirectory(
      "/project/dist-electron/src/main",
      false,
      "/project",
    )).toBe(path.join("/project", "bundled-themes"));
  });

  it("uses the application root in a packaged build", () => {
    expect(resolveBundledThemesDirectory(
      "/Applications/Skin Studio.app/Contents/Resources/app.asar",
      true,
      "/ignored",
    )).toBe(path.join(
      "/Applications/Skin Studio.app/Contents/Resources/app.asar",
      "bundled-themes",
    ));
  });
});
