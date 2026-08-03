import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Renaissance workshop background budget", () => {
  it("ships a static scene plus a bounded transparent person layer", async () => {
    const themeDirectory = path.join(
      process.cwd(),
      "bundled-themes",
      "medieval-scriptorium",
    );
    const [background, person] = await Promise.all([
      fs.stat(path.join(themeDirectory, "background.png")),
      fs.stat(path.join(themeDirectory, "person-motion.png")),
    ]);

    expect(background.size).toBeGreaterThan(1_000_000);
    expect(person.size).toBeGreaterThan(100_000);
    expect(person.size).toBeLessThan(background.size);
    await expect(fs.access(path.join(themeDirectory, "background.svg"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
