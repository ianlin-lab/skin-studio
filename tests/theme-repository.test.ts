import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeRepository } from "../src/main/core/theme-repository";

const temporaryDirectories: string[] = [];
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const tinyGif = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

async function tempDirectory(name: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `skin-studio-${name}-`));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

describe("ThemeRepository", () => {
  it("seeds editable built-in themes and clamps presentation updates", async () => {
    const root = await tempDirectory("seed");
    const repository = new ThemeRepository(root);
    await repository.initialize();
    const themes = await repository.list();
    expect(themes).toHaveLength(1);
    expect(themes[0]).toMatchObject({ id: "claude-warm", name: "Claude Warm", builtin: true });

    const updated = await repository.update(themes[0].id, {
      presentation: { panelOpacity: 8, positionX: -20, accent: "#ABCDEF" },
    });
    expect(updated.presentation.panelOpacity).toBe(1);
    expect(updated.presentation.positionX).toBe(0);
    expect(updated.presentation.accent).toBe("#abcdef");

    const restartedRepository = new ThemeRepository(root);
    await restartedRepository.initialize();
    const afterRestart = await restartedRepository.get(updated.id);
    expect(afterRestart.presentation.panelOpacity).toBe(1);
    expect(afterRestart.presentation.positionX).toBe(0);
    expect(afterRestart.presentation.accent).toBe("#abcdef");
  });

  it("imports an animated-compatible local image as a normalized theme", async () => {
    const root = await tempDirectory("image");
    const repository = new ThemeRepository(path.join(root, "data"));
    await repository.initialize();
    const image = path.join(root, "sample.png");
    await fs.writeFile(image, tinyPng);
    const result = await repository.importPath(image);
    expect(result.ok).toBe(true);
    expect(result.importedThemeIds).toHaveLength(1);
    expect((await repository.list()).some((theme) => theme.id === result.importedThemeIds![0])).toBe(true);
    const imported = await repository.get(result.importedThemeIds![0]);
    expect(imported.presentation.brightness).toBe(0.98);
    expect(imported.presentation.overlayOpacity).toBe(0.12);
    expect(imported.presentation.panelOpacity).toBe(0.46);
    expect(imported.presentation.panelBlur).toBe(0);
    expect(imported.presentation.taskIntensity).toBe(0.82);
  });

  it("upgrades only the legacy default layout of an existing local image theme", async () => {
    const root = await tempDirectory("legacy-image");
    const data = path.join(root, "data");
    const repository = new ThemeRepository(data);
    await repository.initialize();
    const image = path.join(root, "sample.png");
    await fs.writeFile(image, tinyPng);
    const created = await repository.createFromImage(image);
    const themePath = path.join(data, "themes", created.id, "theme.json");
    const raw = JSON.parse(await fs.readFile(themePath, "utf8"));
    raw.presentation = {
      ...raw.presentation,
      brightness: 0.82,
      overlayOpacity: 0.28,
      panelOpacity: 0.72,
      panelBlur: 22,
      taskIntensity: 0.42,
      textTone: "auto",
      accent: "#a86b00",
      colors: { ...raw.presentation.colors, accent: "#a86b00" },
    };
    await fs.writeFile(themePath, JSON.stringify(raw));

    const restarted = new ThemeRepository(data);
    await restarted.initialize();
    const upgraded = await restarted.get(created.id);
    expect(upgraded.presentation).toMatchObject({
      brightness: 0.98,
      overlayOpacity: 0.12,
      panelOpacity: 0.46,
      panelBlur: 0,
      taskIntensity: 0.82,
      textTone: "light",
    });
    expect(upgraded.presentation.colors.accent).toBe("#a86b00");
  });

  it("keeps a dynamic source enabled by default and writes a static fallback beside it", async () => {
    const root = await tempDirectory("animated-image");
    const repository = new ThemeRepository(path.join(root, "data"));
    await repository.initialize();
    const image = path.join(root, "sample.gif");
    await fs.writeFile(image, tinyGif);

    const result = await repository.importPath(image);
    const imported = await repository.get(result.importedThemeIds![0]);

    expect(imported.asset.animated).toBe(true);
    expect(imported.presentation.motionEnabled).toBe(true);
    expect(imported.asset.still).toEqual({ file: "background-still.png", mime: "image/png" });
    expect(imported.stillAssetUrl).toContain("variant=still");
    await expect(fs.access(path.join(root, "data", "themes", imported.id, "background-still.png")))
      .resolves.toBeUndefined();
  });

  it("imports a Dream Skin v1 directory with validated Safe CSS and full colors", async () => {
    const root = await tempDirectory("dream");
    const source = path.join(root, "community-theme");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "background.png"), tinyPng);
    await fs.writeFile(
      path.join(source, "theme.css"),
      '[data-ds-part="sidebar"] { background-color: var(--ds-theme-color-panel); }\n',
      "utf8",
    );
    await fs.writeFile(path.join(source, "theme.json"), JSON.stringify({
      schemaVersion: 1,
      id: "community-sample",
      name: "Community Sample",
      tagline: "Converted safely",
      image: "background.png",
      appearance: "dark",
      art: { focusX: 0.72, focusY: 0.42, taskMode: "ambient" },
      colors: {
        background: "#071014",
        panel: "#151b24",
        panelAlt: "#202a34",
        accent: "#66ccaa",
        accentAlt: "#9debd5",
        secondary: "#6da8ff",
        highlight: "#c48af0",
        text: "#f2f7f5",
        muted: "#a7b6b2",
        line: "rgba(102, 204, 170, .24)",
      },
    }));
    const repository = new ThemeRepository(path.join(root, "data"));
    await repository.initialize();
    const result = await repository.importPath(source);
    const imported = await repository.get(result.importedThemeIds![0]);
    expect(imported.source.adapter).toBe("dream-skin-v1");
    expect(imported.presentation.positionX).toBe(72);
    expect(imported.presentation.accent).toBe("#66ccaa");
    expect(imported.presentation.colors.panel).toBe("#151b24");
    expect(imported.safeCss?.css).toContain('[data-ds-part="sidebar"]');
    expect(imported.source.warnings?.[0]).toContain("Safe CSS");
  });

  it("rejects unsafe community CSS instead of executing or silently dropping it", async () => {
    const root = await tempDirectory("unsafe-css");
    const source = path.join(root, "community-theme");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "background.png"), tinyPng);
    await fs.writeFile(path.join(source, "theme.css"), "body { display: none; }", "utf8");
    await fs.writeFile(path.join(source, "theme.json"), JSON.stringify({
      schemaVersion: 1,
      id: "unsafe-community-sample",
      name: "Unsafe Community Sample",
      image: "background.png",
    }));
    const repository = new ThemeRepository(path.join(root, "data"));
    await repository.initialize();
    await expect(repository.importPath(source)).rejects.toThrow(/选择器不受支持/);
  });

  it("rejects malformed or unrecognizable theme ZIP files", async () => {
    const root = await tempDirectory("zip");
    const archivePath = path.join(root, "unsafe.zip");
    const archive = new AdmZip();
    archive.addFile("../outside.txt", Buffer.from("no"));
    archive.writeZip(archivePath);
    const repository = new ThemeRepository(path.join(root, "data"));
    await repository.initialize();
    await expect(repository.importPath(archivePath)).rejects.toThrow(
      /不安全路径|路径越界|未找到可识别/,
    );
  });
});
