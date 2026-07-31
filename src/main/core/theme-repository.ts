import AdmZip from "adm-zip";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ImportResult,
  StudioSettings,
  ThemeManifest,
  ThemePatch,
  ThemeSource,
  ThemeSummary,
} from "../../shared/types";
import { ACTIVE_BUILTIN_IDS, BUILTIN_THEMES } from "./builtin-themes";
import { validateSafeCss } from "./safe-css";
import {
  DEFAULT_PRESENTATION,
  assertRegularMedia,
  isAnimatedMedia,
  mediaUrl,
  normalizePresentation,
  normalizeColors,
  safeId,
  safeText,
  validateThemeManifest,
  writeJsonAtomic,
} from "./theme-utils";

const MAX_ARCHIVE_BYTES = 48 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 80 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 128;
const DEFAULT_SETTINGS: StudioSettings = {
  followSelectedTheme: true,
  reduceMotion: false,
};

interface ImportedTheme {
  manifest: ThemeManifest;
  sourceAsset: string;
}

export class ThemeRepository {
  readonly rootDir: string;
  readonly themesDir: string;
  readonly settingsPath: string;
  readonly bundledThemesDir: string;

  constructor(rootDir: string, bundledThemesDir?: string) {
    this.rootDir = rootDir;
    this.themesDir = path.join(rootDir, "themes");
    this.settingsPath = path.join(rootDir, "settings.json");
    this.bundledThemesDir = bundledThemesDir ?? path.join(process.cwd(), "bundled-themes");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.themesDir, { recursive: true });
    await Promise.all(BUILTIN_THEMES.map(async ({ manifest, svg, bundledAsset }) => {
      const themeDir = path.join(this.themesDir, manifest.id);
      await fs.mkdir(themeDir, { recursive: true });
      let seededManifest = manifest;
      try {
        const existing = validateThemeManifest(JSON.parse(
          await fs.readFile(path.join(themeDir, "theme.json"), "utf8"),
        ));
        if (existing.id === manifest.id && existing.builtin && existing.source.label === manifest.source.label) {
          seededManifest = {
            ...manifest,
            presentation: existing.presentation,
            updatedAt: existing.updatedAt,
          };
        }
      } catch {
        // A missing or invalid built-in is repaired from the bundled definition.
      }
      const destination = path.join(themeDir, manifest.asset.file);
      if (svg) {
        await fs.writeFile(destination, svg, "utf8");
      } else if (bundledAsset) {
        const source = path.resolve(this.bundledThemesDir, bundledAsset);
        const root = `${path.resolve(this.bundledThemesDir)}${path.sep}`;
        if (!source.startsWith(root)) throw new Error("内置主题素材路径无效");
        await fs.copyFile(source, destination);
      } else {
        throw new Error(`内置主题缺少素材：${manifest.id}`);
      }
      await writeJsonAtomic(path.join(themeDir, "theme.json"), seededManifest);
    }));
    try {
      await fs.access(this.settingsPath);
    } catch {
      await writeJsonAtomic(this.settingsPath, DEFAULT_SETTINGS);
    }
  }

  async list(): Promise<ThemeSummary[]> {
    const entries = await fs.readdir(this.themesDir, { withFileTypes: true });
    const themes = (await Promise.all(entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map(async (entry) => {
        try {
          return await this.readSummary(entry.name);
        } catch {
          return null;
        }
      })))
      .filter((item): item is ThemeSummary => Boolean(item))
      .filter((item) => !item.builtin || ACTIVE_BUILTIN_IDS.has(item.id));
    return themes.sort((left, right) => {
      if (left.builtin !== right.builtin) return left.builtin ? -1 : 1;
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  async get(id: string): Promise<ThemeSummary> {
    return this.readSummary(id);
  }

  async getManifest(id: string): Promise<ThemeManifest> {
    const { manifest } = await this.readTheme(id);
    return manifest;
  }

  async resolveAssetPath(id: string): Promise<string> {
    const { assetPath } = await this.readTheme(id);
    return assetPath;
  }

  resolveThemeDir(id: string): string {
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/i.test(id)) throw new Error("主题 ID 无效");
    return path.join(this.themesDir, id);
  }

  async update(id: string, patch: ThemePatch): Promise<ThemeSummary> {
    const { manifest } = await this.readTheme(id);
    const updated: ThemeManifest = {
      ...manifest,
      name: patch.name === undefined ? manifest.name : safeText(patch.name, manifest.name, 80),
      description: patch.description === undefined
        ? manifest.description
        : safeText(patch.description, manifest.description, 180),
      author: patch.author === undefined ? manifest.author : safeText(patch.author, manifest.author, 60),
      presentation: normalizePresentation({
        ...manifest.presentation,
        ...patch.presentation,
      }, manifest.presentation),
      updatedAt: new Date().toISOString(),
    };
    await writeJsonAtomic(path.join(this.resolveThemeDir(id), "theme.json"), updated);
    return this.readSummary(id);
  }

  async createFromImage(filePath: string, sourceType: ThemeSource["type"] = "image"): Promise<ThemeSummary> {
    const media = await assertRegularMedia(filePath);
    const bytes = await fs.readFile(filePath);
    const name = safeText(path.basename(filePath, media.extension), "我的主题", 80);
    const id = safeId(name);
    const now = new Date().toISOString();
    const assetFile = `background${media.extension}`;
    const manifest: ThemeManifest = {
      format: "skin-studio-theme-v1",
      schemaVersion: 1,
      id,
      name,
      description: media.extension === ".gif" || isAnimatedMedia(media.extension, bytes)
        ? "由本地动态素材生成"
        : "由本地图片生成",
      author: "Local",
      builtin: false,
      asset: {
        file: assetFile,
        mime: media.mime,
        animated: isAnimatedMedia(media.extension, bytes),
      },
      presentation: {
        ...DEFAULT_PRESENTATION,
        appearance: "dark",
      },
      source: {
        type: sourceType,
        label: filePath,
        adapter: "generic-image",
        importedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
    await this.persistImported({ manifest, sourceAsset: filePath });
    return this.readSummary(id);
  }

  async importPath(inputPath: string, sourceType?: ThemeSource["type"]): Promise<ImportResult> {
    const stat = await fs.lstat(inputPath);
    if (stat.isSymbolicLink()) throw new Error("不导入符号链接");
    if (stat.isFile()) {
      if (path.extname(inputPath).toLowerCase() === ".zip") {
        return this.importArchive(inputPath, {
          type: sourceType ?? "zip",
          label: inputPath,
          adapter: "dream-skin-v1",
        });
      }
      const theme = await this.createFromImage(inputPath, sourceType ?? "image");
      return {
        ok: true,
        message: `已导入「${theme.name}」`,
        importedThemeIds: [theme.id],
        themes: await this.list(),
      };
    }
    if (!stat.isDirectory()) throw new Error("请选择普通文件或文件夹");
    const imported = await this.importThemeTree(inputPath, {
      type: sourceType ?? "folder",
      label: inputPath,
      adapter: "dream-skin-v1",
    });
    return this.importedResult(imported);
  }

  async importGithub(repositoryUrl: string): Promise<ImportResult> {
    const parsed = new URL(repositoryUrl.trim());
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
      throw new Error("第一版仅支持公开 github.com 仓库地址");
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1])) {
      throw new Error("GitHub 仓库地址无效");
    }
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    let ref = parts[2] === "tree" && parts[3] ? parts[3] : "";
    if (!ref) {
      const metadataResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Skin-Studio/0.1",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!metadataResponse.ok) throw new Error(`无法读取 GitHub 仓库信息（${metadataResponse.status}）`);
      const metadata = await metadataResponse.json() as { default_branch?: string };
      ref = metadata.default_branch || "main";
    }
    if (!/^[A-Za-z0-9._/-]{1,180}$/.test(ref)) throw new Error("GitHub 分支名不安全");
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-github-"));
    try {
      const treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Skin-Studio/0.1",
          },
          signal: AbortSignal.timeout(18_000),
        },
      );
      if (!treeResponse.ok) throw new Error(`无法读取 GitHub 仓库文件树（${treeResponse.status}）`);
      const treePayload = await treeResponse.json() as {
        truncated?: boolean;
        tree?: Array<{ path?: string; type?: string; size?: number }>;
      };
      const candidates = (treePayload.tree ?? [])
        .filter((item) => (
          item.type === "blob"
          && typeof item.path === "string"
          && /(^|\/)theme\.json$/i.test(item.path)
          && !/(^|\/)(?:node_modules|dist|build|release)\//.test(item.path)
          && (item.size ?? 0) <= 1024 * 1024
        ))
        .slice(0, 16);
      if (!candidates.length) throw new Error("GitHub 仓库中没有可识别的 theme.json");
      let downloadedBytes = 0;
      for (let index = 0; index < candidates.length; index += 1) {
        const themePath = candidates[index].path!;
        const themeBytes = await this.fetchGithubFile(owner, repo, ref, themePath, 1024 * 1024);
        downloadedBytes += themeBytes.length;
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(themeBytes.toString("utf8")) as Record<string, unknown>;
        } catch {
          continue;
        }
        const imageName = raw.format === "skin-studio-theme-v1"
          ? (raw.asset as { file?: unknown } | undefined)?.file
          : raw.image;
        if (typeof imageName !== "string" || path.basename(imageName) !== imageName) continue;
        const themeDirectory = path.join(temporaryRoot, `theme-${index}`);
        const remoteDirectory = path.posix.dirname(themePath);
        const remoteImage = remoteDirectory === "." ? imageName : `${remoteDirectory}/${imageName}`;
        const imageBytes = await this.fetchGithubFile(owner, repo, ref, remoteImage, 30 * 1024 * 1024);
        downloadedBytes += imageBytes.length;
        if (downloadedBytes > 64 * 1024 * 1024) throw new Error("GitHub 主题素材总计超过 64MB");
        await fs.mkdir(themeDirectory, { recursive: true });
        await fs.writeFile(path.join(themeDirectory, "theme.json"), themeBytes, { mode: 0o600 });
        await fs.writeFile(path.join(themeDirectory, imageName), imageBytes, { mode: 0o600 });
        const remoteCss = remoteDirectory === "." ? "theme.css" : `${remoteDirectory}/theme.css`;
        try {
          const cssBytes = await this.fetchGithubFile(owner, repo, ref, remoteCss, 262_144);
          await fs.writeFile(path.join(themeDirectory, "theme.css"), cssBytes, { mode: 0o600 });
        } catch {
          // Dream Skin legacy presets legitimately omit theme.css.
        }
      }
      const imported = await this.importThemeTree(temporaryRoot, {
        type: "github",
        label: `${owner}/${repo}@${ref}`,
        url: repositoryUrl,
        adapter: "dream-skin-v1",
      });
      if (treePayload.truncated && imported[0]) {
        imported[0].manifest.source.warnings = [
          ...(imported[0].manifest.source.warnings ?? []),
          "GitHub 文件树被截断；只导入了可见范围内的主题",
        ];
        await writeJsonAtomic(
          path.join(this.resolveThemeDir(imported[0].manifest.id), "theme.json"),
          imported[0].manifest,
        );
      }
      return this.importedResult(imported);
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  async getSettings(): Promise<StudioSettings> {
    try {
      const raw = JSON.parse(await fs.readFile(this.settingsPath, "utf8")) as Partial<StudioSettings>;
      return {
        followSelectedTheme: raw.followSelectedTheme !== false,
        reduceMotion: raw.reduceMotion === true,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(patch: Partial<StudioSettings>): Promise<StudioSettings> {
    const current = await this.getSettings();
    const next = {
      followSelectedTheme: patch.followSelectedTheme ?? current.followSelectedTheme,
      reduceMotion: patch.reduceMotion ?? current.reduceMotion,
    };
    await writeJsonAtomic(this.settingsPath, next);
    return next;
  }

  private async readSummary(id: string): Promise<ThemeSummary> {
    const { manifest } = await this.readTheme(id);
    return {
      ...manifest,
      assetUrl: mediaUrl(manifest.id, manifest.updatedAt),
    };
  }

  private async readTheme(id: string): Promise<{ manifest: ThemeManifest; assetPath: string }> {
    const themeDir = this.resolveThemeDir(id);
    const directoryStat = await fs.lstat(themeDir);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error("主题目录无效");
    const manifest = validateThemeManifest(JSON.parse(
      await fs.readFile(path.join(themeDir, "theme.json"), "utf8"),
    ));
    if (manifest.id !== id) throw new Error("主题 ID 与目录不一致");
    const assetPath = path.join(themeDir, manifest.asset.file);
    await assertRegularMedia(assetPath);
    return { manifest, assetPath };
  }

  private async importArchive(archivePath: string, source: ThemeSource): Promise<ImportResult> {
    const archiveStat = await fs.lstat(archivePath);
    if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.size > MAX_ARCHIVE_BYTES) {
      throw new Error("ZIP 必须是不超过 48MB 的普通文件");
    }
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();
    if (entries.length < 1 || entries.length > MAX_ARCHIVE_ENTRIES) {
      throw new Error("ZIP 条目数量不在安全范围内");
    }
    let expanded = 0;
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-import-"));
    try {
      for (const entry of entries) {
        const normalized = path.posix.normalize(entry.entryName.replace(/\\/g, "/"));
        if (
          normalized.startsWith("../")
          || normalized.startsWith("/")
          || normalized.includes("/../")
          || normalized.includes("\0")
        ) throw new Error(`ZIP 包含不安全路径：${entry.entryName}`);
        const mode = (entry.header.attr >>> 16) & 0o170000;
        if (mode === 0o120000) throw new Error("ZIP 不允许包含符号链接");
        const targetPath = path.join(temporaryRoot, ...normalized.split("/"));
        const relative = path.relative(temporaryRoot, targetPath);
        if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("ZIP 路径越界");
        if (entry.isDirectory) {
          await fs.mkdir(targetPath, { recursive: true });
          continue;
        }
        const bytes = entry.getData();
        expanded += bytes.length;
        if (expanded > MAX_EXTRACTED_BYTES) throw new Error("ZIP 解压后超过 80MB");
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, bytes, { mode: 0o600 });
      }
      const imported = await this.importThemeTree(temporaryRoot, source);
      return this.importedResult(imported);
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }

  private async importThemeTree(root: string, source: ThemeSource): Promise<ImportedTheme[]> {
    const candidates = await this.findThemeCandidates(root);
    if (!candidates.length) throw new Error("未找到可识别的 theme.json 与背景素材");
    const imported: ImportedTheme[] = [];
    const fingerprints = new Set<string>();
    const errors: string[] = [];
    for (const candidate of candidates.slice(0, 16)) {
      try {
        const adapted = await this.adaptThemeDirectory(candidate, source);
        const bytes = await fs.readFile(adapted.sourceAsset);
        const fingerprint = crypto.createHash("sha256").update(bytes).digest("hex");
        if (fingerprints.has(fingerprint)) continue;
        fingerprints.add(fingerprint);
        await this.persistImported(adapted);
        imported.push(adapted);
      } catch (error) {
        errors.push(`${path.basename(candidate)}：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!imported.length) throw new Error(errors[0] || "没有主题通过安全校验");
    if (errors.length) {
      imported[0].manifest.source.warnings = [
        ...(imported[0].manifest.source.warnings ?? []),
        ...errors.slice(0, 5),
      ];
      await writeJsonAtomic(
        path.join(this.resolveThemeDir(imported[0].manifest.id), "theme.json"),
        imported[0].manifest,
      );
    }
    return imported;
  }

  private async findThemeCandidates(root: string): Promise<string[]> {
    const found: string[] = [];
    let visited = 0;
    const walk = async (directory: string, depth: number): Promise<void> => {
      if (depth > 7 || visited > 500 || found.length >= 24) return;
      visited += 1;
      const entries = await fs.readdir(directory, { withFileTypes: true });
      if (entries.some((entry) => entry.isFile() && entry.name === "theme.json")) {
        found.push(directory);
        return;
      }
      for (const entry of entries) {
        if (
          entry.isDirectory()
          && !entry.isSymbolicLink()
          && ![".git", "node_modules", "dist", "build", "release"].includes(entry.name)
        ) {
          await walk(path.join(directory, entry.name), depth + 1);
        }
      }
    };
    await walk(root, 0);
    return found;
  }

  private async adaptThemeDirectory(directory: string, source: ThemeSource): Promise<ImportedTheme> {
    const raw = JSON.parse(await fs.readFile(path.join(directory, "theme.json"), "utf8")) as Record<string, unknown>;
    if (raw.format === "skin-studio-theme-v1") {
      const original = validateThemeManifest(raw);
      const sourceAsset = path.join(directory, original.asset.file);
      await assertRegularMedia(sourceAsset);
      const id = safeId(original.name);
      const now = new Date().toISOString();
      return {
        sourceAsset,
        manifest: {
          ...original,
          id,
          builtin: false,
          source: { ...source, adapter: "skin-studio-v1", importedAt: now },
          createdAt: now,
          updatedAt: now,
        },
      };
    }
    if (raw.schemaVersion !== 1 || typeof raw.image !== "string") {
      throw new Error("不是已支持的 Skin Studio 或 Dream Skin 主题");
    }
    try {
      const packageManifest = JSON.parse(
        await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
      ) as { platforms?: unknown; capabilities?: unknown };
      if (
        Array.isArray(packageManifest.platforms)
        && !packageManifest.platforms.includes("macos")
      ) throw new Error("Dream Skin 主题包未声明支持 macOS");
      if (
        packageManifest.capabilities !== undefined
        && (!Array.isArray(packageManifest.capabilities)
          || !packageManifest.capabilities.includes("safe-css"))
      ) throw new Error("Dream Skin 正式主题包缺少 safe-css 能力声明");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const imageName = path.basename(raw.image);
    if (imageName !== raw.image) throw new Error("Dream Skin 图片路径必须位于主题目录根部");
    const sourceAsset = path.join(directory, imageName);
    const media = await assertRegularMedia(sourceAsset);
    const colors = raw.colors && typeof raw.colors === "object" && !Array.isArray(raw.colors)
      ? raw.colors as Record<string, unknown>
      : {};
    const art = raw.art && typeof raw.art === "object" && !Array.isArray(raw.art)
      ? raw.art as Record<string, unknown>
      : {};
    const appearance = raw.appearance === "light" || raw.appearance === "dark" ? raw.appearance : "auto";
    const name = safeText(raw.name, "Dream Skin 主题", 80);
    const now = new Date().toISOString();
    const warnings: string[] = [];
    let safeCss: ThemeManifest["safeCss"];
    try {
      const css = await fs.readFile(path.join(directory, "theme.css"), "utf8");
      const validated = validateSafeCss(css);
      safeCss = { contract: validated.contract, css: validated.css };
      warnings.push(`theme.css 已通过 Safe CSS 校验（${validated.ruleCount} 条规则）`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      warnings.push("该主题没有 theme.css；已按 Dream Skin legacy 主题转换");
    }
    const focusX = typeof art.focusX === "number" ? art.focusX * 100 : 50;
    const focusY = typeof art.focusY === "number" ? art.focusY * 100 : 50;
    const importedColors = normalizeColors({
      background: colors.background as string | undefined,
      panel: colors.panel as string | undefined,
      panelAlt: colors.panelAlt as string | undefined,
      accent: colors.accent as string | undefined,
      accentAlt: colors.accentAlt as string | undefined,
      secondary: colors.secondary as string | undefined,
      highlight: colors.highlight as string | undefined,
      text: colors.text as string | undefined,
      muted: colors.muted as string | undefined,
      line: colors.line as string | undefined,
    }, DEFAULT_PRESENTATION.colors);
    const accent = importedColors.accent;
    const presentation = normalizePresentation({
      ...DEFAULT_PRESENTATION,
      appearance,
      positionX: focusX,
      positionY: focusY,
      accent,
      brightness: appearance === "light" ? 1.02 : 0.78,
      textTone: appearance === "light" ? "dark" : appearance === "dark" ? "light" : "auto",
      panelOpacity: appearance === "light" ? 0.78 : 0.7,
      overlayOpacity: appearance === "light" ? 0.1 : 0.28,
      taskIntensity: art.taskMode === "full" ? 0.72 : art.taskMode === "off" ? 0.12 : 0.4,
      colors: importedColors,
    });
    return {
      sourceAsset,
      manifest: {
        format: "skin-studio-theme-v1",
        schemaVersion: 1,
        id: safeId(name),
        name,
        description: safeText(raw.tagline, "从 Codex Dream Skin 主题转换", 180),
        author: "Community",
        builtin: false,
        asset: {
          file: `background${media.extension}`,
          mime: media.mime,
          animated: isAnimatedMedia(media.extension, await fs.readFile(sourceAsset)),
        },
        presentation,
        safeCss,
        source: {
          ...source,
          adapter: "dream-skin-v1",
          importedAt: now,
          warnings,
        },
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  private async persistImported(imported: ImportedTheme): Promise<void> {
    const themeDir = this.resolveThemeDir(imported.manifest.id);
    await fs.mkdir(themeDir, { recursive: false });
    try {
      await fs.copyFile(imported.sourceAsset, path.join(themeDir, imported.manifest.asset.file));
      await writeJsonAtomic(path.join(themeDir, "theme.json"), imported.manifest);
    } catch (error) {
      await fs.rm(themeDir, { recursive: true, force: true });
      throw error;
    }
  }

  private async importedResult(imported: ImportedTheme[]): Promise<ImportResult> {
    const warnings = imported.flatMap((item) => item.manifest.source.warnings ?? []);
    return {
      ok: true,
      message: imported.length === 1
        ? `已导入「${imported[0].manifest.name}」`
        : `已导入 ${imported.length} 个主题`,
      importedThemeIds: imported.map((item) => item.manifest.id),
      themes: await this.list(),
      warnings,
    };
  }

  private async fetchGithubFile(
    owner: string,
    repo: string,
    ref: string,
    filePath: string,
    maxBytes: number,
  ): Promise<Buffer> {
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
      `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodedPath}`,
      {
        headers: { "User-Agent": "Skin-Studio/0.1" },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) throw new Error(`GitHub 文件下载失败（${response.status}）：${filePath}`);
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > maxBytes) throw new Error(`GitHub 文件超过大小限制：${filePath}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1 || bytes.length > maxBytes) throw new Error(`GitHub 文件大小无效：${filePath}`);
    return bytes;
  }
}
