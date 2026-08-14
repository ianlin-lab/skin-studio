import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileImage,
  FolderOpen,
  GitBranch,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  Palette,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BackgroundVisibilityOverride,
  CodexStatus,
  DashboardData,
  OperationResult,
  ThemeColors,
  ThemePresentation,
  ThemeSummary,
} from "../shared/types";
import {
  applyBackgroundVisibility,
  detachBackgroundVisibilityField,
  effectiveBackgroundVisibility,
  restoreBackgroundVisibilityField,
} from "./background-visibility";
import {
  buildStudioBackgroundStyle,
  buildStudioMotionStyle,
  displayedBackgroundUrl,
  resolveTextToneColors,
} from "./studio-theme";
import brandIconUrl from "../../assets/brand/skin-studio-icon.png";

type Toast = { tone: "success" | "error" | "info"; message: string } | null;
type ImportMode = "local" | "github" | null;
type PendingThemeSave = {
  presentation: ThemePresentation;
  version: number;
};

const rangeFormatters = {
  brightness: (value: number) => `${Math.round(value * 100)}%`,
  scale: (value: number) => `${Math.round(value * 100)}%`,
  radius: (value: number) => `${Math.round(value)} px`,
  taskIntensity: (value: number) => `${Math.round(value * 100)}%`,
};

const BACKGROUND_DETAIL_KEYS: readonly BackgroundVisibilityOverride[] = ["overlayOpacity", "panelBlur"];
const REGION_TRANSPARENCY_KEYS: readonly BackgroundVisibilityOverride[] = [
  "panelOpacity",
  "taskIntensity",
  "composerOpacity",
  "popupOpacity",
];
const SOURCE_FILTER_OPTIONS = [
  ["all", "全部"],
  ["builtin", "内置"],
  ["personal", "我的主题"],
] as const;

function customOverrideCount(
  presentation: ThemePresentation,
  keys: readonly BackgroundVisibilityOverride[],
): number {
  const overrides = new Set(presentation.backgroundVisibilityOverrides ?? []);
  return keys.filter((key) => overrides.has(key)).length;
}

function opacityToTransparency(opacity: number): number {
  return Math.min(1, Math.max(0, (1 - opacity) / 0.7));
}

function transparencyToOpacity(transparency: number): number {
  return 1 - Math.min(1, Math.max(0, transparency)) * 0.7;
}

function overlayToTransparency(opacity: number): number {
  return 1 - Math.min(0.8, Math.max(0, opacity)) / 0.8;
}

function transparencyToOverlay(transparency: number): number {
  return (1 - Math.min(1, Math.max(0, transparency))) * 0.8;
}

function blurToClarity(blur: number): number {
  return 1 - Math.min(48, Math.max(0, blur)) / 48;
}

function clarityToBlur(clarity: number): number {
  return Math.round((1 - Math.min(1, Math.max(0, clarity))) * 48);
}

function inheritedComposerOpacity(panelOpacity: number): number {
  return Math.min(0.98, panelOpacity + 0.13);
}

function inheritedPopupOpacity(panelOpacity: number): number {
  return Math.min(0.99, panelOpacity + 0.16);
}

function contrastTextFor(color: string): string {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) return "#ffffff";

  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 156 ? "#111318" : "#ffffff";
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "builtin" | "personal">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [importMode, setImportMode] = useState<ImportMode>(null);
  const [inspectorMenuOpen, setInspectorMenuOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("https://github.com/Fei-Away/Codex-Dream-Skin");
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const saveTimers = useRef(new Map<string, number>());
  const pendingSaves = useRef(new Map<string, PendingThemeSave>());
  const saveChains = useRef(new Map<string, Promise<void>>());
  const editVersions = useRef(new Map<string, number>());
  const persistedPresentations = useRef(new Map<string, ThemePresentation>());
  const inspectorMenuRef = useRef<HTMLDivElement>(null);

  function rememberPersistedPresentations(themes: ThemeSummary[]) {
    for (const theme of themes) persistedPresentations.current.set(theme.id, theme.presentation);
  }

  useEffect(() => {
    let alive = true;
    window.skinStudio.bootstrap()
      .then((value) => {
        if (!alive) return;
        rememberPersistedPresentations(value.themes);
        setData(value);
        setSelectedId(value.activeThemeId || value.themes[0]?.id || null);
      })
      .catch((error) => setToast({ tone: "error", message: String(error) }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!data) return;
    const timer = window.setInterval(async () => {
      try {
        const codex = await window.skinStudio.refreshStatus();
        setData((current) => current ? {
          ...current,
          codex,
          activeThemeId: codex.runtime.activeThemeId,
        } : current);
      } catch {
        // Transient status failures should not disrupt editing.
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [Boolean(data)]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setInspectorMenuOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!inspectorMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectorMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [inspectorMenuOpen]);

  const selected = data?.themes.find((theme) => theme.id === selectedId) ?? null;
  const activeTheme = data?.themes.find((theme) => theme.id === data.activeThemeId) ?? null;
  const hasPendingCodexChanges = Boolean(
    selected
    && selected.id === data?.activeThemeId
    && data?.codex.runtime.appliedThemeUpdatedAt
    && data.codex.runtime.appliedThemeUpdatedAt !== selected.updatedAt,
  );
  const filteredThemes = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.themes.filter((theme) => {
      if (sourceFilter === "builtin" && !theme.builtin) return false;
      if (sourceFilter === "personal" && theme.builtin) return false;
      return !query || `${theme.name} ${theme.description} ${theme.author}`.toLowerCase().includes(query);
    });
  }, [data, search, sourceFilter]);

  const studioStyle = useMemo(() => {
    return buildStudioBackgroundStyle(selected, Boolean(data?.settings.followSelectedTheme));
  }, [selected, data?.settings.followSelectedTheme]);
  const studioMotionStyle = useMemo(() => (
    buildStudioMotionStyle(selected, Boolean(data?.settings.followSelectedTheme), viewport)
  ), [selected, data?.settings.followSelectedTheme, viewport]);

  async function refreshDashboard(preferredId?: string) {
    const next = await window.skinStudio.bootstrap();
    rememberPersistedPresentations(next.themes);
    setData(next);
    if (preferredId && next.themes.some((theme) => theme.id === preferredId)) setSelectedId(preferredId);
  }

  function commitPresentationSave(id: string, pending: PendingThemeSave): Promise<void> {
    const previous = saveChains.current.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      try {
        const updated = await window.skinStudio.updateTheme(id, {
          presentation: pending.presentation,
        });
        persistedPresentations.current.set(id, updated.presentation);
        if (editVersions.current.get(id) !== pending.version) return;
        setData((current) => current ? {
          ...current,
          themes: current.themes.map((theme) => theme.id === updated.id ? updated : theme),
        } : current);
      } catch (error) {
        if (editVersions.current.get(id) === pending.version) {
          const persisted = persistedPresentations.current.get(id);
          if (persisted) {
            setData((current) => current ? {
              ...current,
              themes: current.themes.map((theme) => theme.id === id
                ? { ...theme, presentation: persisted }
                : theme),
            } : current);
          }
        }
        throw error;
      }
    });
    saveChains.current.set(id, next);
    void next.finally(() => {
      if (saveChains.current.get(id) === next) saveChains.current.delete(id);
    }).catch(() => undefined);
    return next;
  }

  function queuePresentationSave(id: string, presentation: ThemePresentation) {
    const version = (editVersions.current.get(id) ?? 0) + 1;
    editVersions.current.set(id, version);
    pendingSaves.current.set(id, { presentation, version });
    const existingTimer = saveTimers.current.get(id);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      saveTimers.current.delete(id);
      const pending = pendingSaves.current.get(id);
      pendingSaves.current.delete(id);
      if (!pending) return;
      void commitPresentationSave(id, pending).catch((error) => {
        setToast({ tone: "error", message: error instanceof Error ? error.message : String(error) });
      });
    }, 280);
    saveTimers.current.set(id, timer);
  }

  async function flushPendingSave() {
    for (const timer of saveTimers.current.values()) window.clearTimeout(timer);
    saveTimers.current.clear();
    const pending = Array.from(pendingSaves.current.entries());
    pendingSaves.current.clear();
    const existing = Array.from(saveChains.current.values());
    const queued = pending.map(([id, save]) => commitPresentationSave(id, save));
    await Promise.all([...existing, ...queued]);
  }

  function updatePresentation(patch: Partial<ThemePresentation>) {
    if (!selected) return;
    let next = { ...selected.presentation, ...patch };
    const automaticSurfaceChanged = patch.textTone === "auto"
      || patch.panelOpacity !== undefined
      || Boolean(patch.colors && (
        patch.colors.background !== selected.presentation.colors.background
        || patch.colors.panel !== selected.presentation.colors.panel
      ));
    if (next.textTone === "auto" && automaticSurfaceChanged) {
      next = {
        ...next,
        colors: {
          ...next.colors,
          ...resolveTextToneColors("auto", next),
        },
      };
    }
    setData((current) => current ? {
      ...current,
      themes: current.themes.map((theme) => theme.id === selected.id
        ? { ...theme, presentation: next }
        : theme),
    } : current);
    queuePresentationSave(selected.id, next);
  }

  function updateColor(key: keyof ThemeColors, value: string) {
    if (!selected) return;
    updatePresentation({
      accent: key === "accent" ? value : selected.presentation.accent,
      colors: {
        ...selected.presentation.colors,
        [key]: value,
      },
    });
  }

  function updateTextTone(tone: ThemePresentation["textTone"]) {
    if (!selected) return;
    updatePresentation({
      textTone: tone,
      colors: {
        ...selected.presentation.colors,
        ...resolveTextToneColors(tone, selected.presentation),
      },
    });
  }

  async function runOperation(label: string, operation: () => Promise<OperationResult>) {
    setBusy(label);
    try {
      await flushPendingSave();
      const result = await operation();
      if (result.codex) {
        setData((current) => current ? {
          ...current,
          codex: result.codex!,
          activeThemeId: result.activeThemeId ?? result.codex!.runtime.activeThemeId,
        } : current);
      }
      if (result.themes) {
        setData((current) => current ? { ...current, themes: result.themes! } : current);
        if (selectedId && !result.themes.some((theme) => theme.id === selectedId)) {
          setSelectedId(
            result.activeThemeId
            ?? result.codex?.runtime.activeThemeId
            ?? result.themes[0]?.id
            ?? null,
          );
        }
      }
      setToast({ tone: result.ok ? "success" : "error", message: result.message });
      return result;
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function chooseImport(kind: "image" | "folder") {
    setBusy(`import-${kind}`);
    try {
      const result = await window.skinStudio.chooseAndImport(kind);
      if (result.ok && result.importedThemeIds?.[0]) {
        await refreshDashboard(result.importedThemeIds[0]);
        setImportMode(null);
      }
      setToast({ tone: result.ok ? "success" : "info", message: result.message });
      if (result.warnings?.length) {
        window.setTimeout(() => setToast({ tone: "info", message: result.warnings![0] }), 900);
      }
    } finally {
      setBusy(null);
    }
  }

  async function importGithub(event: FormEvent) {
    event.preventDefault();
    setBusy("import-github");
    try {
      const result = await window.skinStudio.importGithub(githubUrl);
      if (result.ok && result.importedThemeIds?.[0]) {
        await refreshDashboard(result.importedThemeIds[0]);
        setImportMode(null);
      }
      setToast({ tone: result.ok ? "success" : "error", message: result.message });
      if (result.warnings?.[0]) {
        window.setTimeout(() => setToast({ tone: "info", message: result.warnings![0] }), 900);
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleSelfSkin() {
    if (!data) return;
    const settings = await window.skinStudio.updateSettings({
      followSelectedTheme: !data.settings.followSelectedTheme,
    });
    setData({ ...data, settings });
  }

  async function saveThemeInfo(id: string, name: string, description: string) {
    const theme = data?.themes.find((item) => item.id === id);
    const nextName = name.trim();
    const nextDescription = description.trim();
    if (!theme) return;
    if (!nextName) {
      setToast({ tone: "error", message: "主题名称不能为空" });
      return;
    }
    if (nextName === theme.name && nextDescription === theme.description) return;

    setBusy("theme-info");
    try {
      await flushPendingSave();
      const updated = await window.skinStudio.updateTheme(id, {
        name: nextName,
        description: nextDescription,
      });
      setData((current) => current ? {
        ...current,
        themes: current.themes.map((item) => item.id === updated.id ? updated : item),
      } : current);
      setToast({ tone: "success", message: "主题信息已保存" });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="brand-mark large"><img src={brandIconUrl} alt="" /></div>
        <LoaderCircle className="spin" size={22} />
        <span>正在检查 Codex 与本地主题…</span>
      </div>
    );
  }

  return (
    <div
      className={`studio ${data.settings.followSelectedTheme ? "self-themed" : ""}`}
      style={studioStyle}
      onPointerDownCapture={(event) => {
        if (inspectorMenuOpen && !inspectorMenuRef.current?.contains(event.target as Node)) {
          setInspectorMenuOpen(false);
        }
      }}
    >
      {studioMotionStyle && <div className="studio-motion-layer" style={studioMotionStyle} />}
      <div className="drag-region" />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><img src={brandIconUrl} alt="" /></div>
          <div>
            <strong>Skin Studio</strong>
            <span>Codex 主题管理器</span>
          </div>
        </div>

        <TargetStatus codex={data.codex} />

        <nav className="side-nav">
          <button className="nav-item active">
            <Layers3 size={17} />
            <span>主题库</span>
            <span className="nav-count">{data.themes.length}</span>
          </button>
          <button className="nav-item" onClick={() => void chooseImport("image")}>
            <ImagePlus size={17} />
            <span>从素材创建</span>
            <ChevronRight size={15} />
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <button className="self-skin-row" onClick={toggleSelfSkin}>
          <div>
            <span>界面跟随主题</span>
            <small>让 Skin Studio 同步预览配色</small>
          </div>
          <span className={`toggle ${data.settings.followSelectedTheme ? "on" : ""}`}>
            <i />
          </span>
        </button>
      </aside>

      <main className="library">
        <header className="library-header">
          <div>
            <h1>选择今天的工作氛围</h1>
            <p>主题只作用于界面表现，随时可以回到原生外观。</p>
          </div>
          <button className="primary compact" onClick={() => setImportMode("local")}>
            <Plus size={17} />
            导入主题
          </button>
        </header>

        <div className="library-tools">
          <div
            className="segmented small"
            style={{
              "--segment-index": SOURCE_FILTER_OPTIONS.findIndex(([value]) => value === sourceFilter),
              "--segment-count": SOURCE_FILTER_OPTIONS.length,
            } as CSSProperties}
          >
            <span className="segmented-indicator" aria-hidden="true" />
            {SOURCE_FILTER_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                className={sourceFilter === value ? "selected" : ""}
                onClick={() => setSourceFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索主题"
            />
          </label>
        </div>

        <section className="theme-grid">
          {filteredThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={theme.id === selectedId}
              active={theme.id === data.activeThemeId}
              onSelect={() => setSelectedId(theme.id)}
            />
          ))}
        </section>
      </main>

      <aside className="inspector">
        {selected ? (
          <>
            <div className="inspector-head">
              <div>
                <h2>{selected.name}</h2>
              </div>
              <div className="inspector-actions" ref={inspectorMenuRef}>
                <button
                  className="icon-button"
                  title="更多操作"
                  aria-label="更多操作"
                  aria-expanded={inspectorMenuOpen}
                  onClick={() => setInspectorMenuOpen((open) => !open)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {inspectorMenuOpen && (
                  <div className="inspector-menu" role="menu">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setInspectorMenuOpen(false);
                        void window.skinStudio.revealTheme(selected.id);
                      }}
                    >
                      <FolderOpen size={15} />
                      在 Finder 中显示
                    </button>
                    {!selected.builtin && (
                      <button
                        className="danger"
                        role="menuitem"
                        onClick={() => {
                          setInspectorMenuOpen(false);
                          void runOperation("delete", () => window.skinStudio.deleteTheme(selected.id));
                        }}
                      >
                        <Trash2 size={15} />
                        删除主题
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <ThemePreview theme={selected} />

            <div className="inspector-scroll">
              {!selected.builtin && (
                <ThemeInfoEditor
                  theme={selected}
                  busy={busy === "theme-info"}
                  onSave={saveThemeInfo}
                />
              )}
              <ControlSection title="画面构图" icon={<FileImage size={15} />}>
                {selected.asset.animated && (selected.asset.still || selected.asset.motion) && (
                  <div className="motion-toggle-row">
                    <div>
                      <strong>背景动效</strong>
                      <small>关闭后使用静态背景；Studio 与 Codex 会同步</small>
                    </div>
                    <button
                      className={`toggle ${selected.presentation.motionEnabled !== false ? "on" : ""}`}
                      role="switch"
                      aria-checked={selected.presentation.motionEnabled !== false}
                      title={selected.presentation.motionEnabled !== false ? "关闭背景动效" : "开启背景动效"}
                    onClick={() => updatePresentation({
                      motionEnabled: selected.presentation.motionEnabled === false,
                    })}
                  >
                      <i />
                    </button>
                  </div>
                )}
                <SegmentedControl
                  value={selected.presentation.fit}
                  options={[
                    ["cover", "铺满"],
                    ["contain", "完整"],
                    ["fill", "拉伸"],
                  ]}
                  onChange={(value) => updatePresentation({ fit: value as ThemePresentation["fit"] })}
                />
                <RangeControl
                  label="缩放"
                  value={selected.presentation.scale}
                  min={0.7}
                  max={2.2}
                  step={0.01}
                  format={rangeFormatters.scale}
                  onChange={(value) => updatePresentation({ scale: value })}
                />
                <div className="two-controls">
                  <RangeControl
                    label="水平"
                    value={selected.presentation.positionX}
                    min={0}
                    max={100}
                    step={1}
                    format={(value) => `${Math.round(value)}%`}
                    onChange={(value) => updatePresentation({ positionX: value })}
                  />
                  <RangeControl
                    label="垂直"
                    value={selected.presentation.positionY}
                    min={0}
                    max={100}
                    step={1}
                    format={(value) => `${Math.round(value)}%`}
                    onChange={(value) => updatePresentation({ positionY: value })}
                  />
                </div>
              </ControlSection>

              <ControlSection title="背景透明度" icon={<Sparkles size={15} />}>
                <p className="transparency-copy">
                  数值越高，背景越清晰；数值越低，文字区域更易阅读。
                </p>
                <RangeControl
                  label="背景透明度"
                  value={effectiveBackgroundVisibility(selected.presentation)}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  onChange={(value) => updatePresentation(
                    applyBackgroundVisibility(selected.presentation, value),
                  )}
                />
                <DisclosureGroup
                  key={`background-details-${selected.id}`}
                  title="背景细节"
                  status={customOverrideCount(selected.presentation, BACKGROUND_DETAIL_KEYS) > 0
                    ? `已自定义 ${customOverrideCount(selected.presentation, BACKGROUND_DETAIL_KEYS)} 项`
                    : "自动"}
                >
                  <RangeControl
                    label="画面亮度"
                    value={selected.presentation.brightness}
                    min={0.25}
                    max={1.3}
                    step={0.01}
                    format={rangeFormatters.brightness}
                    onChange={(value) => updatePresentation({ brightness: value })}
                  />
                  <LinkedRangeControl
                    label="遮罩透明度"
                    value={overlayToTransparency(selected.presentation.overlayOpacity)}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    isFollowing={!selected.presentation.backgroundVisibilityOverrides?.includes("overlayOpacity")}
                    onChange={(value) => updatePresentation(detachBackgroundVisibilityField(
                      selected.presentation,
                      "overlayOpacity",
                      transparencyToOverlay(value),
                    ))}
                    onRestore={() => updatePresentation(restoreBackgroundVisibilityField(
                      selected.presentation,
                      "overlayOpacity",
                    ))}
                  />
                  <LinkedRangeControl
                    label="背景清晰度"
                    value={blurToClarity(selected.presentation.panelBlur)}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    isFollowing={!selected.presentation.backgroundVisibilityOverrides?.includes("panelBlur")}
                    onChange={(value) => updatePresentation(detachBackgroundVisibilityField(
                      selected.presentation,
                      "panelBlur",
                      clarityToBlur(value),
                    ))}
                    onRestore={() => updatePresentation(restoreBackgroundVisibilityField(
                      selected.presentation,
                      "panelBlur",
                    ))}
                  />
                </DisclosureGroup>
              </ControlSection>

              <DisclosureSection
                key={`region-transparency-${selected.id}`}
                title="区域透明度"
                icon={<Layers3 size={15} />}
                status={customOverrideCount(selected.presentation, REGION_TRANSPARENCY_KEYS) > 0
                  ? `已自定义 ${customOverrideCount(selected.presentation, REGION_TRANSPARENCY_KEYS)} 项`
                  : "自动"}
              >
                <LinkedRangeControl
                  label="侧栏与顶部"
                  value={opacityToTransparency(selected.presentation.panelOpacity)}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  isFollowing={!selected.presentation.backgroundVisibilityOverrides?.includes("panelOpacity")}
                  onChange={(value) => updatePresentation(detachBackgroundVisibilityField(
                    selected.presentation,
                    "panelOpacity",
                    transparencyToOpacity(value),
                  ))}
                  onRestore={() => updatePresentation(restoreBackgroundVisibilityField(
                    selected.presentation,
                    "panelOpacity",
                  ))}
                />
                <LinkedRangeControl
                  label="对话区域"
                  value={selected.presentation.taskIntensity}
                  min={0}
                  max={1}
                  step={0.01}
                  format={rangeFormatters.taskIntensity}
                  isFollowing={!selected.presentation.backgroundVisibilityOverrides?.includes("taskIntensity")}
                  onChange={(value) => updatePresentation(detachBackgroundVisibilityField(
                    selected.presentation,
                    "taskIntensity",
                    value,
                  ))}
                  onRestore={() => updatePresentation(restoreBackgroundVisibilityField(
                    selected.presentation,
                    "taskIntensity",
                  ))}
                />
                <LinkedRangeControl
                  label="聊天输入框"
                  value={opacityToTransparency(selected.presentation.composerOpacity
                    ?? inheritedComposerOpacity(selected.presentation.panelOpacity))}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  isFollowing={!selected.presentation.backgroundVisibilityOverrides?.includes("composerOpacity")}
                  onChange={(value) => updatePresentation(detachBackgroundVisibilityField(
                    selected.presentation,
                    "composerOpacity",
                    transparencyToOpacity(value),
                  ))}
                  onRestore={() => updatePresentation(restoreBackgroundVisibilityField(
                    selected.presentation,
                    "composerOpacity",
                  ))}
                />
                <LinkedRangeControl
                  label="弹窗与菜单"
                  value={opacityToTransparency(selected.presentation.popupOpacity
                    ?? inheritedPopupOpacity(selected.presentation.panelOpacity))}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => `${Math.round(value * 100)}%`}
                  isFollowing={!selected.presentation.backgroundVisibilityOverrides?.includes("popupOpacity")}
                  onChange={(value) => updatePresentation(detachBackgroundVisibilityField(
                    selected.presentation,
                    "popupOpacity",
                    transparencyToOpacity(value),
                  ))}
                  onRestore={() => updatePresentation(restoreBackgroundVisibilityField(
                    selected.presentation,
                    "popupOpacity",
                  ))}
                />
              </DisclosureSection>

              <ControlSection title="色彩与文字" icon={<Palette size={15} />}>
                <RangeControl
                  label="界面圆角"
                  value={selected.presentation.radius}
                  min={8}
                  max={26}
                  step={1}
                  format={rangeFormatters.radius}
                  onChange={(value) => updatePresentation({ radius: value })}
                />
                <div className="color-grid">
                  <ColorControl
                    label="背景"
                    value={selected.presentation.colors.background}
                    onChange={(value) => updateColor("background", value)}
                  />
                  <ColorControl
                    label="面板"
                    value={selected.presentation.colors.panel}
                    onChange={(value) => updateColor("panel", value)}
                  />
                  <ColorControl
                    label="浮层"
                    value={selected.presentation.colors.panelAlt}
                    onChange={(value) => updateColor("panelAlt", value)}
                  />
                  <ColorControl
                    label="强调"
                    value={selected.presentation.colors.accent}
                    onChange={(value) => updateColor("accent", value)}
                  />
                  <ColorControl
                    label="强调浅色"
                    value={selected.presentation.colors.accentAlt}
                    onChange={(value) => updateColor("accentAlt", value)}
                  />
                  <ColorControl
                    label="辅助色"
                    value={selected.presentation.colors.secondary}
                    onChange={(value) => updateColor("secondary", value)}
                  />
                  <ColorControl
                    label="正文"
                    value={selected.presentation.colors.text}
                    onChange={(value) => updateColor("text", value)}
                  />
                  <ColorControl
                    label="弱文字"
                    value={selected.presentation.colors.muted}
                    onChange={(value) => updateColor("muted", value)}
                  />
                </div>
                <SegmentedControl
                  value={selected.presentation.textTone}
                  options={[
                    ["auto", "自动"],
                    ["light", "浅色字"],
                    ["dark", "深色字"],
                  ]}
                  onChange={(value) => updateTextTone(value as ThemePresentation["textTone"])}
                />
              </ControlSection>

            </div>

            <div className="action-dock">
              <div className={`apply-state ${selected.id === data.activeThemeId
                ? hasPendingCodexChanges ? "pending" : "applied"
                : "previewing"}`}>
                <span />
                <p>{selected.id === data.activeThemeId
                  ? hasPendingCodexChanges
                    ? "右侧调整已保存；尚未应用到 Codex"
                    : "已应用到 Codex"
                  : <>仅在 Studio 预览；Codex 当前仍在使用「{activeTheme?.name ?? "原生界面"}」</>}
                </p>
              </div>
              <div className="action-row">
                <button
                  className="primary grow"
                  disabled={Boolean(busy)}
                  onClick={() => runOperation(
                    "apply",
                    () => selected.id === data.activeThemeId
                      ? window.skinStudio.reapplyTheme()
                      : window.skinStudio.applyTheme(selected.id),
                  )}
                >
                  {busy === "apply" ? <LoaderCircle className="spin" size={17} /> : (
                    selected.id === data.activeThemeId ? <RefreshCw size={17} /> : <Play size={17} />
                  )}
                  {selected.id === data.activeThemeId
                    ? hasPendingCodexChanges ? "应用更改到 Codex" : "重新应用"
                    : "应用到 Codex"}
                </button>
                <button
                  className="secondary icon-only"
                  title="恢复 Codex 原生界面"
                  disabled={Boolean(busy)}
                  onClick={() => runOperation("restore", () => window.skinStudio.restoreCodex())}
                >
                  {busy === "restore" ? <LoaderCircle className="spin" size={17} /> : <RotateCcw size={17} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-inspector">
            <Settings2 size={22} />
            <span>选择一个主题进行预览和调节</span>
          </div>
        )}
      </aside>

      {importMode && (
        <ImportSheet
          mode={importMode}
          busy={busy}
          githubUrl={githubUrl}
          onGithubUrl={setGithubUrl}
          onChoose={chooseImport}
          onGithub={importGithub}
          onClose={() => setImportMode(null)}
          onMode={setImportMode}
        />
      )}

      {toast && <ToastView toast={toast} />}
    </div>
  );
}

function TargetStatus({ codex }: { codex: CodexStatus }) {
  const state = !codex.installation.installed
    ? "missing"
    : codex.runtime.state === "active"
      ? "active"
      : codex.running
        ? "running"
        : "idle";
  const connectionCopy = !codex.installation.installed
    ? "未检测到安装"
    : codex.runtime.state === "active"
      ? "已应用主题"
      : codex.running
        ? "运行中 · 原生外观"
        : "未启动";
  const version = codex.installation.version ? ` · ${codex.installation.version}` : "";
  return (
    <div className={`target-card ${state}`}>
      <div className="target-icon"><Monitor size={18} /></div>
      <div className="target-copy">
        <span>当前适配应用</span>
        <strong>Codex</strong>
        <small>{connectionCopy}{version}</small>
      </div>
      <RuntimeDot state={codex.runtime.state} />
    </div>
  );
}

function RuntimeDot({ state }: { state: CodexStatus["runtime"]["state"] }) {
  return <span className={`runtime-dot ${state}`} />;
}

function ThemeCard({
  theme,
  selected,
  active,
  onSelect,
}: {
  theme: ThemeSummary;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const previewStyle = {
    "--card-image": `url("${displayedBackgroundUrl(theme)}")`,
    "--card-position": `${theme.presentation.positionX}% ${theme.presentation.positionY}%`,
    "--card-size": theme.presentation.fit === "fill" ? "100% 100%" : theme.presentation.fit,
    "--card-brightness": theme.presentation.brightness,
    "--card-scale": theme.presentation.scale,
    "--card-overlay": theme.presentation.overlayOpacity,
    "--card-panel": theme.presentation.panelOpacity,
    "--card-accent": theme.presentation.accent,
    "--card-on-accent": contrastTextFor(theme.presentation.accent),
    "--card-bg": theme.presentation.colors.background,
    "--card-panel-color": theme.presentation.colors.panel,
    "--card-text": theme.presentation.colors.text,
    "--card-muted": theme.presentation.colors.muted,
  } as CSSProperties;
  return (
    <button className={`theme-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="card-preview" style={previewStyle}>
        <div className="mini-sidebar">
          <span />
          <i />
          <i />
          <i />
        </div>
        <div className="mini-canvas">
          <div className="mini-top"><span /><i /><i /></div>
          <div className="mini-content">
            <strong />
            <span />
            <span />
            <div className="mini-composer"><i /><b /></div>
          </div>
        </div>
        {theme.asset.animated && (
          <span className="motion-chip"><Play size={10} fill="currentColor" /> 动态</span>
        )}
        {active && <span className="active-check"><Check size={13} /></span>}
      </div>
      <div className="card-meta">
        <div>
          <strong>{theme.name}</strong>
          <span>{theme.builtin ? "内置" : theme.source.adapter === "dream-skin-v1" ? "Dream Skin" : "个人"}</span>
        </div>
        <span className="accent-swatch" style={{ background: theme.presentation.accent }} />
      </div>
      <p>{theme.description}</p>
    </button>
  );
}

function ThemePreview({ theme }: { theme: ThemeSummary }) {
  const style = {
    "--preview-image": `url("${displayedBackgroundUrl(theme)}")`,
    "--preview-position": `${theme.presentation.positionX}% ${theme.presentation.positionY}%`,
    "--preview-size": theme.presentation.fit === "fill" ? "100% 100%" : theme.presentation.fit,
    "--preview-brightness": theme.presentation.brightness,
    "--preview-scale": theme.presentation.scale,
    "--preview-overlay": theme.presentation.overlayOpacity,
    "--preview-panel": theme.presentation.panelOpacity,
    "--preview-blur": `${theme.presentation.panelBlur / 2}px`,
    "--preview-accent": theme.presentation.accent,
    "--preview-bg": theme.presentation.colors.background,
    "--preview-panel-color": theme.presentation.colors.panel,
    "--preview-panel-alt": theme.presentation.colors.panelAlt,
    "--preview-text": theme.presentation.colors.text,
    "--preview-muted": theme.presentation.colors.muted,
  } as CSSProperties;
  return (
    <div className="large-preview" style={style}>
      <div className="preview-traffic"><i /><i /><i /></div>
      <div className="preview-sidebar">
        <span className="preview-logo" />
        <i />
        <i />
        <i />
        <i className="bottom" />
      </div>
      <div className="preview-work">
        <div className="preview-header"><span>Codex</span><i /><i /></div>
        <div className="preview-body">
          <p>What are we building?</p>
          <div className="preview-prompt">
            <span>Ask Codex anything</span>
            <b />
          </div>
          <div className="preview-suggestions"><i /><i /><i /></div>
        </div>
      </div>
      {theme.asset.animated && <div className="preview-motion">LIVE</div>}
    </div>
  );
}

function ControlSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="control-section">
      <h3>{icon}{title}</h3>
      {children}
    </section>
  );
}

function ThemeInfoEditor({
  theme,
  busy,
  onSave,
}: {
  theme: ThemeSummary;
  busy: boolean;
  onSave: (id: string, name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(theme.name);
  const [description, setDescription] = useState(theme.description);

  useEffect(() => {
    setName(theme.name);
    setDescription(theme.description);
  }, [theme.id, theme.name, theme.description]);

  const dirty = name.trim() !== theme.name || description.trim() !== theme.description;

  return (
    <ControlSection title="主题信息" icon={<Settings2 size={15} />}>
      <form
        className="theme-info-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(theme.id, name, description);
        }}
      >
        <label className="theme-info-field">
          <span>主题名称</span>
          <input
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            aria-label="主题名称"
          />
        </label>
        <label className="theme-info-field">
          <span>主题介绍</span>
          <textarea
            value={description}
            maxLength={180}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
            aria-label="主题介绍"
          />
        </label>
        <button className="primary theme-info-save" type="submit" disabled={!dirty || busy}>
          {busy ? <LoaderCircle className="spin" size={14} /> : null}
          保存信息
        </button>
      </form>
    </ControlSection>
  );
}

function DisclosureGroup({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <details className="setting-disclosure nested-disclosure">
      <summary>
        <span>{title}</span>
        <small>{status}</small>
        <ChevronRight size={13} />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

function DisclosureSection({
  title,
  icon,
  status,
  children,
}: {
  title: string;
  icon: ReactNode;
  status: string;
  children: ReactNode;
}) {
  return (
    <details className="setting-disclosure section-disclosure">
      <summary>
        <span className="disclosure-title">{icon}{title}</span>
        <small>{status}</small>
        <ChevronRight size={13} />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  const selectedIndex = Math.max(0, options.findIndex(([option]) => option === value));
  return (
    <div
      className="segmented control"
      style={{
        "--segment-index": selectedIndex,
        "--segment-count": options.length,
      } as CSSProperties}
    >
      <span className="segmented-indicator" aria-hidden="true" />
      {options.map(([option, label]) => (
        <button
          key={option}
          className={value === option ? "selected" : ""}
          onClick={() => onChange(option)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <label className="range-control">
      <span><b>{label}</b><small>{format(value)}</small></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--range-progress": `${percentage}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function LinkedRangeControl({
  isFollowing,
  onRestore,
  ...props
}: Parameters<typeof RangeControl>[0] & {
  isFollowing: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="linked-range-control">
      <RangeControl {...props} />
      {isFollowing ? (
        <span className="follow-chip">跟随整体</span>
      ) : (
        <button type="button" className="restore-follow" onClick={onRestore}>恢复跟随</button>
      )}
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <input
        className="color-input"
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ImportSheet({
  mode,
  busy,
  githubUrl,
  onGithubUrl,
  onChoose,
  onGithub,
  onClose,
  onMode,
}: {
  mode: ImportMode;
  busy: string | null;
  githubUrl: string;
  onGithubUrl: (value: string) => void;
  onChoose: (kind: "image" | "folder") => void;
  onGithub: (event: FormEvent) => void;
  onClose: () => void;
  onMode: (mode: ImportMode) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="import-sheet">
        <div className="sheet-head">
          <div>
            <p className="eyebrow">LOCAL IMPORT</p>
            <h2>{mode === "github" ? "从 GitHub 导入" : "添加到主题库"}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        {mode === "github" ? (
          <form className="github-form" onSubmit={onGithub}>
            <div className="github-mark"><GitBranch size={24} /></div>
            <label>
              <span>公开仓库地址</span>
              <input
                value={githubUrl}
                onChange={(event) => onGithubUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
                autoFocus
              />
            </label>
            <p>只读取公开仓库中的主题配置和素材，不执行脚本。会扫描 Skin Studio v1 与 Dream Skin v1 主题目录。</p>
            <div className="sheet-actions">
              <button type="button" className="secondary" onClick={() => onMode("local")}>返回</button>
              <button className="primary" disabled={busy === "import-github"}>
                {busy === "import-github" ? <LoaderCircle className="spin" size={16} /> : <GitBranch size={16} />}
                下载并检查
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="import-options">
              <button onClick={() => onChoose("image")}>
                <span className="import-icon image"><FileImage size={21} /></span>
                <strong>从图片创建</strong>
                <small>PNG、JPG、GIF、WebP、SVG</small>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => onChoose("folder")}>
                <span className="import-icon folder"><FolderOpen size={21} /></span>
                <strong>导入主题文件夹</strong>
                <small>选择已解压的主题目录</small>
                <ChevronRight size={16} />
              </button>
              <button className="github-option" onClick={() => onMode("github")}>
                <span className="import-icon github"><GitBranch size={21} /></span>
                <strong>从 GitHub 导入</strong>
                <small>粘贴公开仓库地址并检查主题</small>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="compatibility-note">
              <ShieldCheck size={17} />
              <p>
                <strong>兼容说明</strong>
                <span>支持 Skin Studio 主题和部分 Dream Skin 主题；导入时只读取图片、配置和受限样式，不运行脚本。复杂主题可能只保留背景与配色。</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ToastView({ toast }: { toast: Exclude<Toast, null> }) {
  return (
    <div className={`toast ${toast.tone}`}>
      {toast.tone === "success"
        ? <CircleCheck size={17} />
        : toast.tone === "error"
          ? <CircleAlert size={17} />
          : <ExternalLink size={17} />}
      <span>{toast.message}</span>
    </div>
  );
}

export default App;
