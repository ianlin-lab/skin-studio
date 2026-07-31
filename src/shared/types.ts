export type ThemeAppearance = "auto" | "light" | "dark";
export type BackgroundFit = "cover" | "contain" | "fill";
export type TextTone = "auto" | "light" | "dark";
export type RuntimeThemeState = "stock" | "active" | "stale" | "unknown";

export interface ThemeColors {
  background: string;
  panel: string;
  panelAlt: string;
  accent: string;
  accentAlt: string;
  secondary: string;
  highlight: string;
  text: string;
  muted: string;
  line: string;
}

export interface ThemePresentation {
  appearance: ThemeAppearance;
  fit: BackgroundFit;
  positionX: number;
  positionY: number;
  scale: number;
  brightness: number;
  overlayOpacity: number;
  panelOpacity: number;
  panelBlur: number;
  radius: number;
  accent: string;
  textTone: TextTone;
  taskIntensity: number;
  colors: ThemeColors;
}

export interface ThemeSource {
  type: "builtin" | "image" | "folder" | "zip" | "github";
  label: string;
  url?: string;
  adapter?: "skin-studio-v1" | "dream-skin-v1" | "generic-image";
  importedAt?: string;
  warnings?: string[];
}

export interface ThemeManifest {
  format: "skin-studio-theme-v1";
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  author: string;
  builtin: boolean;
  asset: {
    file: string;
    mime: string;
    animated: boolean;
  };
  presentation: ThemePresentation;
  safeCss?: {
    contract: "dreamskin-safe-css/1";
    css: string;
  };
  source: ThemeSource;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeSummary extends ThemeManifest {
  assetUrl: string;
}

export interface CodexInstallation {
  installed: boolean;
  bundlePath: string | null;
  executablePath: string | null;
  bundleId: string | null;
  version: string | null;
  architecture: string | null;
}

export interface CodexStatus {
  installation: CodexInstallation;
  running: boolean;
  processIds: number[];
  runtime: {
    state: RuntimeThemeState;
    activeThemeId: string | null;
    port: number | null;
    managedLaunch: boolean;
    injectedTargets: number;
    message: string;
  };
}

export interface StudioSettings {
  followSelectedTheme: boolean;
  reduceMotion: boolean;
}

export interface DashboardData {
  themes: ThemeSummary[];
  codex: CodexStatus;
  settings: StudioSettings;
  activeThemeId: string | null;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  codex?: CodexStatus;
  themes?: ThemeSummary[];
  activeThemeId?: string | null;
  warnings?: string[];
}

export interface ImportResult extends OperationResult {
  importedThemeIds?: string[];
}

export type ThemePatch = Partial<
  Pick<ThemeManifest, "name" | "description" | "author">
> & {
  presentation?: Partial<ThemePresentation>;
};

export interface SkinStudioApi {
  bootstrap(): Promise<DashboardData>;
  refreshStatus(): Promise<CodexStatus>;
  chooseAndImport(kind: "image" | "folder"): Promise<ImportResult>;
  importGithub(url: string): Promise<ImportResult>;
  updateTheme(id: string, patch: ThemePatch): Promise<ThemeSummary>;
  deleteTheme(id: string): Promise<OperationResult>;
  applyTheme(id: string): Promise<OperationResult>;
  reapplyTheme(): Promise<OperationResult>;
  restoreCodex(): Promise<OperationResult>;
  updateSettings(patch: Partial<StudioSettings>): Promise<StudioSettings>;
  revealTheme(id: string): Promise<void>;
}

declare global {
  interface Window {
    skinStudio: SkinStudioApi;
  }
}
