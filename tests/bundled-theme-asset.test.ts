import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Renaissance workshop background budget", () => {
  it("uses one raster scene without full-image masks or blur filters", async () => {
    const svg = await fs.readFile(path.join(
      process.cwd(),
      "bundled-themes",
      "medieval-scriptorium",
      "background.svg",
    ), "utf8");

    expect(svg.match(/<use xlink:href="#master"\/>/g)).toHaveLength(1);
    expect(svg).not.toContain("<mask");
    expect(svg).not.toContain("<feGaussianBlur");
    expect(svg).toContain('class="ambient-motion"');
  });
});
