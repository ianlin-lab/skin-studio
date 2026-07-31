import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Renaissance workshop background budget", () => {
  it("uses one static scene and one person cutout without masks or blur filters", async () => {
    const bundledSvg = await fs.readFile(path.join(
      process.cwd(),
      "bundled-themes",
      "medieval-scriptorium",
      "background.svg",
    ), "utf8");
    const sourceSvg = await fs.readFile(path.join(
      process.cwd(),
      "assets",
      "motion",
      "pen-spin",
      "renaissance-living-parallax-v3.svg",
    ), "utf8");

    expect(bundledSvg).toBe(sourceSvg);
    expect(bundledSvg.match(/<use xlink:href="#master"\/>/g)).toHaveLength(1);
    expect(bundledSvg.match(/<use xlink:href="#person"\/>/g)).toHaveLength(1);
    expect(bundledSvg).not.toContain("<mask");
    expect(bundledSvg).not.toContain("<feGaussianBlur");
    expect(bundledSvg).toContain('id="personClip"');
    expect(bundledSvg).toContain('class="person-motion"');
    expect(bundledSvg).toContain("@keyframes personFloat");
    expect(bundledSvg).not.toContain("sceneFloat");
    expect(bundledSvg).not.toContain("ambient-motion");
  });
});
