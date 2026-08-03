import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  BackgroundFit,
  TextTone,
  ThemeAppearance,
  BackgroundVisibilityOverride,
  ThemeManifest,
  ThemeColors,
  ThemeMotionLayer,
  ThemeStillAsset,
  ThemePresentation,
} from "../../shared/types";
import { validateSafeCss } from "./safe-css";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_LINE_COLOR = /^(?:#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d{1,4}))?\s*\))$/i;
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SUPPORTED_MEDIA = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);

export const DEFAULT_PRESENTATION: ThemePresentation = {
  appearance: "auto",
  fit: "cover",
  positionX: 50,
  positionY: 50,
  scale: 1,
  brightness: 0.82,
  overlayOpacity: 0.28,
  panelOpacity: 0.72,
  panelBlur: 22,
  radius: 16,
  accent: "#7c6cff",
  textTone: "auto",
  taskIntensity: 0.42,
  colors: {
    background: "#0d0f14",
    panel: "#181a21",
    panelAlt: "#22252e",
    accent: "#7c6cff",
    accentAlt: "#a89dff",
    secondary: "#66cbb2",
    highlight: "#da86cb",
    text: "#f7f7f5",
    muted: "#b8bac3",
    line: "#414650",
  },
};

/**
 * A photo should remain the visual focus of a theme created from a single local
 * image. Community themes carry their own art direction, so keep their legacy
 * defaults separate from this import-specific starting point.
 */
export const IMAGE_FIRST_PRESENTATION: ThemePresentation = {
  ...DEFAULT_PRESENTATION,
  appearance: "dark",
  brightness: 0.98,
  overlayOpacity: 0.12,
  panelOpacity: 0.46,
  panelBlur: 0,
  taskIntensity: 0.82,
  textTone: "light",
};

export function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function optionalOpacity(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0.3, value))
    : undefined;
}

const BACKGROUND_VISIBILITY_OVERRIDE_KEYS: readonly BackgroundVisibilityOverride[] = [
  "overlayOpacity",
  "panelOpacity",
  "taskIntensity",
  "panelBlur",
  "composerOpacity",
  "popupOpacity",
];

function normalizeBackgroundVisibilityOverrides(value: unknown): BackgroundVisibilityOverride[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const overrides = value.filter((item): item is BackgroundVisibilityOverride =>
    typeof item === "string" && BACKGROUND_VISIBILITY_OVERRIDE_KEYS.includes(item as BackgroundVisibilityOverride),
  );
  return Array.from(new Set(overrides));
}

export function safeText(value: unknown, fallback: string, max = 120): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return Array.from(normalized).slice(0, max).join("") || fallback;
}

export function safeId(input: string): string {
  const slug = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const base = SAFE_ID.test(slug) ? slug : "theme";
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === "string" && choices.includes(value as T) ? (value as T) : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

function lineColor(value: unknown, fallback: string): string {
  return typeof value === "string" && SAFE_LINE_COLOR.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

function boundedInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function normalizeMotionLayer(value: unknown): ThemeMotionLayer | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Partial<ThemeMotionLayer>;
  if (typeof source.file !== "string") return undefined;
  const file = path.basename(source.file);
  const extension = path.extname(file).toLowerCase();
  const mime = SUPPORTED_MEDIA.get(extension);
  const canvasWidth = boundedInteger(source.canvasWidth, 1, 8_192);
  const canvasHeight = boundedInteger(source.canvasHeight, 1, 8_192);
  const cropX = boundedInteger(source.cropX, 0, 8_191);
  const cropY = boundedInteger(source.cropY, 0, 8_191);
  const cropWidth = boundedInteger(source.cropWidth, 1, 8_192);
  const cropHeight = boundedInteger(source.cropHeight, 1, 8_192);
  const originX = boundedInteger(source.originX, 0, 8_192);
  const originY = boundedInteger(source.originY, 0, 8_192);
  if (
    file !== source.file || !mime || !canvasWidth || !canvasHeight || cropX === null || cropY === null
    || !cropWidth || !cropHeight || originX === null || originY === null
    || cropX + cropWidth > canvasWidth || cropY + cropHeight > canvasHeight
    || originX > canvasWidth || originY > canvasHeight
  ) return undefined;
  return {
    file,
    mime,
    canvasWidth,
    canvasHeight,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    originX,
    originY,
  };
}

function normalizeStillAsset(value: unknown): ThemeStillAsset | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Partial<ThemeStillAsset>;
  if (typeof source.file !== "string") return undefined;
  const file = path.basename(source.file);
  const mime = SUPPORTED_MEDIA.get(path.extname(file).toLowerCase());
  if (file !== source.file || !mime) return undefined;
  return { file, mime };
}

export function normalizeColors(
  value: Partial<ThemeColors> | undefined,
  fallback: ThemeColors = DEFAULT_PRESENTATION.colors,
): ThemeColors {
  return {
    background: color(value?.background, fallback.background),
    panel: color(value?.panel, fallback.panel),
    panelAlt: color(value?.panelAlt, fallback.panelAlt),
    accent: color(value?.accent, fallback.accent),
    accentAlt: color(value?.accentAlt, fallback.accentAlt),
    secondary: color(value?.secondary, fallback.secondary),
    highlight: color(value?.highlight, fallback.highlight),
    text: color(value?.text, fallback.text),
    muted: color(value?.muted, fallback.muted),
    line: lineColor(value?.line, fallback.line),
  };
}

export function normalizePresentation(
  value: Partial<ThemePresentation> | undefined,
  fallback: ThemePresentation = DEFAULT_PRESENTATION,
): ThemePresentation {
  const colors = normalizeColors(value?.colors, fallback.colors);
  const accent = color(value?.accent, colors.accent);
  const composerOpacity = optionalOpacity(value?.composerOpacity);
  const popupOpacity = optionalOpacity(value?.popupOpacity);
  const motionEnabled = typeof value?.motionEnabled === "boolean" ? value.motionEnabled : undefined;
  const backgroundVisibility = typeof value?.backgroundVisibility === "number"
    ? clamp(value.backgroundVisibility, 0, 1, 0.5)
    : undefined;
  const backgroundVisibilityOverrides = normalizeBackgroundVisibilityOverrides(
    value?.backgroundVisibilityOverrides,
  );
  colors.accent = accent;
  return {
    appearance: choice<ThemeAppearance>(value?.appearance, ["auto", "light", "dark"], fallback.appearance),
    fit: choice<BackgroundFit>(value?.fit, ["cover", "contain", "fill"], fallback.fit),
    positionX: clamp(value?.positionX, 0, 100, fallback.positionX),
    positionY: clamp(value?.positionY, 0, 100, fallback.positionY),
    scale: clamp(value?.scale, 0.7, 2.2, fallback.scale),
    brightness: clamp(value?.brightness, 0.25, 1.3, fallback.brightness),
    overlayOpacity: clamp(value?.overlayOpacity, 0, 0.8, fallback.overlayOpacity),
    panelOpacity: clamp(value?.panelOpacity, 0.3, 1, fallback.panelOpacity),
    ...(composerOpacity === undefined ? {} : { composerOpacity }),
    ...(popupOpacity === undefined ? {} : { popupOpacity }),
    ...(motionEnabled === undefined ? {} : { motionEnabled }),
    ...(backgroundVisibility === undefined ? {} : { backgroundVisibility }),
    ...(backgroundVisibilityOverrides === undefined ? {} : { backgroundVisibilityOverrides }),
    panelBlur: clamp(value?.panelBlur, 0, 48, fallback.panelBlur),
    radius: clamp(value?.radius, 8, 26, fallback.radius),
    accent,
    textTone: choice<TextTone>(value?.textTone, ["auto", "light", "dark"], fallback.textTone),
    taskIntensity: clamp(value?.taskIntensity, 0, 1, fallback.taskIntensity),
    colors,
  };
}

export function validateThemeManifest(raw: unknown): ThemeManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("主题清单不是有效对象");
  }
  const source = raw as Partial<ThemeManifest>;
  if (source.format !== "skin-studio-theme-v1" || source.schemaVersion !== 1) {
    throw new Error("不支持的 Skin Studio 主题格式");
  }
  if (!source.asset || typeof source.asset.file !== "string") {
    throw new Error("主题缺少背景素材");
  }
  const basename = path.basename(source.asset.file);
  if (basename !== source.asset.file || !SUPPORTED_MEDIA.has(path.extname(basename).toLowerCase())) {
    throw new Error("主题素材文件名或格式无效");
  }
  const now = new Date().toISOString();
  const motion = normalizeMotionLayer(source.asset.motion);
  const still = normalizeStillAsset(source.asset.still);
  let safeCss: ThemeManifest["safeCss"];
  if (source.safeCss?.contract === "dreamskin-safe-css/1" && typeof source.safeCss.css === "string") {
    const validated = validateSafeCss(source.safeCss.css);
    safeCss = { contract: validated.contract, css: validated.css };
  }
  return {
    format: "skin-studio-theme-v1",
    schemaVersion: 1,
    id: safeText(source.id, "theme", 72),
    name: safeText(source.name, "未命名主题", 80),
    description: safeText(source.description, "本地主题", 180),
    author: safeText(source.author, "Local", 60),
    builtin: Boolean(source.builtin),
    asset: {
      file: basename,
      mime: SUPPORTED_MEDIA.get(path.extname(basename).toLowerCase())!,
      animated: Boolean(motion) || ([".gif", ".webp", ".svg"].includes(path.extname(basename).toLowerCase())
        ? Boolean(source.asset.animated)
        : false),
      ...(still ? { still } : {}),
      ...(motion ? { motion } : {}),
    },
    presentation: normalizePresentation(source.presentation),
    safeCss,
    source: {
      type: source.source?.type ?? "folder",
      label: safeText(source.source?.label, "本地主题", 160),
      url: typeof source.source?.url === "string" ? source.source.url.slice(0, 500) : undefined,
      adapter: source.source?.adapter,
      importedAt: source.source?.importedAt,
      warnings: Array.isArray(source.source?.warnings)
        ? source.source.warnings.map((item) => safeText(item, "", 180)).filter(Boolean).slice(0, 12)
        : undefined,
    },
    createdAt: typeof source.createdAt === "string" ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
  };
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, filePath);
}

export async function assertRegularMedia(filePath: string, maxBytes = 30 * 1024 * 1024): Promise<{
  extension: string;
  mime: string;
  size: number;
}> {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maxBytes) {
    throw new Error(`素材必须是 1B–${Math.round(maxBytes / 1024 / 1024)}MB 的普通文件`);
  }
  const extension = path.extname(filePath).toLowerCase();
  const mime = SUPPORTED_MEDIA.get(extension);
  if (!mime) throw new Error("仅支持 PNG、JPEG、GIF、WebP 与 SVG 素材");
  return { extension, mime, size: stat.size };
}

export function isAnimatedMedia(extension: string, bytes?: Buffer): boolean {
  if (extension === ".gif") return true;
  if (!bytes) return false;
  if (extension === ".webp") {
    return bytes.includes(Buffer.from("ANIM")) || bytes.includes(Buffer.from("ANMF"));
  }
  if (extension === ".svg") {
    return /<animate(?:Transform|Motion)?\b|animation\s*:/i.test(bytes.toString("utf8"));
  }
  return false;
}

export function mediaUrl(
  themeId: string,
  revision: string,
  variant: "base" | "still" | "motion" = "base",
): string {
  return `skin-studio://asset/${encodeURIComponent(themeId)}?v=${encodeURIComponent(revision)}&variant=${variant}`;
}
