import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ThemeRepository } from "../src/main/core/theme-repository";

async function main() {
  const source = process.argv[2]
    || "/private/tmp/skin-studio-research/dream-skin/macos/presets/preset-gothic-void-crusade";
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-community-check-"));
  try {
    const repository = new ThemeRepository(path.join(root, "data"));
    await repository.initialize();
    const result = /^https:\/\/github\.com\//i.test(source)
      ? await repository.importGithub(source)
      : await (async () => {
          const stat = await fs.stat(source);
          if (!stat.isDirectory()) throw new Error(`Community source is not a directory: ${source}`);
          return repository.importPath(source, "folder");
        })();
    const imported = await Promise.all((result.importedThemeIds ?? []).map((id) => repository.get(id)));
    process.stdout.write(`${JSON.stringify({
      ok: result.ok,
      source,
      imported: imported.map((theme) => ({
        id: theme.id,
        name: theme.name,
        adapter: theme.source.adapter,
        assetMime: theme.asset.mime,
        accent: theme.presentation.accent,
        warnings: theme.source.warnings,
      })),
    }, null, 2)}\n`);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

void main();
