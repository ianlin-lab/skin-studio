import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildInjectionPayload } from "../src/main/adapters/injected-theme";
import type { ThemeManifest } from "../src/shared/types";

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
    const manifest = JSON.parse(await fs.readFile(path.join(themeDirectory, "theme.json"), "utf8")) as ThemeManifest;
    expect(manifest.asset.file).toBe("background.png");
    expect(manifest.asset.motion?.file).toBe("person-motion.png");
    const payload = await buildInjectionPayload(manifest, path.join(themeDirectory, manifest.asset.file));
    expect(payload.expression).toContain(`--color-text-prose: ${manifest.presentation.colors.text}`);
    expect(payload.expression).toContain("--composer-layout-surface-background: rgba(56, 35, 24, 0.720)");
    expect(payload.expression).toContain("--color-text: var(--skin-text)");
    expect(payload.expression).toContain("skin-studio-person-float");
    await expect(fs.access(path.join(themeDirectory, "background.svg"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
