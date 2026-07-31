import {
  Archive,
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
  CodexStatus,
  DashboardData,
  OperationResult,
  ThemeColors,
  ThemePresentation,
  ThemeSummary,
} from "../shared/types";
import { buildStudioBackgroundStyle } from "./studio-theme";

type Toast = { tone: "success" | "error" | "info"; message: string } | null;
type ImportMode = "image" | "theme" | "folder" | "github" | null;
type PendingThemeSave = {
  presentation: ThemePresentation;
  version: number;
};

const rangeFormatters = {
  brightness: (value: number) => `${Math.round(value * 100)}%`,
  overlayOpacity: (value: number) => `${Math.round(value * 100)}%`,
  panelOpacity: (value: number) => `${Math.round(value * 100)}%`,
  panelBlur: (value: number) => `${Math.round(value)} px`,
  scale: (value: number) => `${Math.round(value * 100)}%`,
  radius: (value: number) => `${Math.round(value)} px`,
  taskIntensity: (value: number) => `${Math.round(value * 100)}%`,
};

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "builtin" | "imported">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [importMode, setImportMode] = useState<ImportMode>(null);
  const [githubUrl, setGithubUrl] = useState("https://github.com/Fei-Away/Codex-Dream-Skin");
  const saveTimers = useRef(new Map<string, number>());
  const pendingSaves = useRef(new Map<string, PendingThemeSave>());
  const saveChains = useRef(new Map<string, Promise<void>>());
  const editVersions = useRef(new Map<string, number>());

  useEffect(() => {
    let alive = true;
    window.skinStudio.bootstrap()
      .then((value) => {
        if (!alive) return;
        setData(value);
        setSelectedId(value.activeThemeId || value.themes[0]?.id || null);
      })
      .catch((error) => setToast({ tone: "error", message: String(error) }));
    return () => {
      alive = false;
    };
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

  const selected = data?.themes.find((theme) => theme.id === selectedId) ?? null;
  const filteredThemes = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.themes.filter((theme) => {
      if (sourceFilter === "builtin" && !theme.builtin) return false;
      if (sourceFilter === "imported" && theme.builtin) return false;
      return !query || `${theme.name} ${theme.description} ${theme.author}`.toLowerCase().includes(query);
    });
  }, [data, search, sourceFilter]);

  const studioStyle = useMemo(() => {
    return buildStudioBackgroundStyle(selected, Boolean(data?.settings.followSelectedTheme));
  }, [selected, data?.settings.followSelectedTheme]);

  async function refreshDashboard(preferredId?: string) {
    const next = await window.skinStudio.bootstrap();
    setData(next);
    if (preferredId && next.themes.some((theme) => theme.id === preferredId)) setSelectedId(preferredId);
  }

  function commitPresentationSave(id: string, pending: PendingThemeSave): Promise<void> {
    const previous = saveChains.current.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      const updated = await window.skinStudio.updateTheme(id, {
        presentation: pending.presentation,
      });
      if (editVersions.current.get(id) !== pending.version) return;
      setData((current) => current ? {
        ...current,
        themes: current.themes.map((theme) => theme.id === updated.id ? updated : theme),
      } : current);
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
    const next = { ...selected.presentation, ...patch };
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

  async function chooseImport(kind: "image" | "theme" | "folder") {
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

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="brand-mark large"><Palette size={26} /></div>
        <LoaderCircle className="spin" size={22} />
        <span>正在检查 Codex 与本地主题…</span>
      </div>
    );
  }

  return (
    <div
      className={`studio ${data.settings.followSelectedTheme ? "self-themed" : ""}`}
      style={studioStyle}
    >
      <div className="drag-region" />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Palette size={18} /></div>
          <div>
            <strong>Skin Studio</strong>
            <span>Local theme lab</span>
          </div>
        </div>

        <TargetStatus codex={data.codex} />

        <nav className="side-nav">
          <button className="nav-item active">
            <Layers3 size={17} />
            <span>主题库</span>
            <span className="nav-count">{data.themes.length}</span>
          </button>
          <button className="nav-item" onClick={() => setImportMode("image")}>
            <ImagePlus size={17} />
            <span>导入素材</span>
            <ChevronRight size={15} />
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="safety-note">
          <div className="safety-icon"><ShieldCheck size={16} /></div>
          <div>
            <strong>可逆注入</strong>
            <span>不修改 app.asar、项目或对话</span>
          </div>
        </div>

        <button className="self-skin-row" onClick={toggleSelfSkin}>
          <div>
            <span>Studio 跟随预览</span>
            <small>随当前选中主题换肤</small>
          </div>
          <span className={`toggle ${data.settings.followSelectedTheme ? "on" : ""}`}>
            <i />
          </span>
        </button>
      </aside>

      <main className="library">
        <header className="library-header">
          <div>
            <p className="eyebrow">CODEX · LOCAL</p>
            <h1>选择今天的工作氛围</h1>
            <p>主题只作用于界面表现，随时可以回到原生外观。</p>
          </div>
          <button className="primary compact" onClick={() => setImportMode("image")}>
            <Plus size={17} />
            导入
          </button>
        </header>

        <div className="library-tools">
          <div className="segmented small">
            {([
              ["all", "全部"],
              ["builtin", "内置"],
              ["imported", "已导入"],
            ] as const).map(([value, label]) => (
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
          <button className="add-card" onClick={() => setImportMode("image")}>
            <span><Plus size={21} /></span>
            <strong>创建新主题</strong>
            <small>图片、GIF 或动态 WebP</small>
          </button>
        </section>
      </main>

      <aside className="inspector">
        {selected ? (
          <>
            <div className="inspector-head">
              <div>
                <p className="eyebrow">LIVE PREVIEW</p>
                <h2>{selected.name}</h2>
              </div>
              <button
                className="icon-button"
                title="在 Finder 中显示"
                onClick={() => window.skinStudio.revealTheme(selected.id)}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <ThemePreview theme={selected} />

            <div className="inspector-scroll">
              <ControlSection title="画面" icon={<FileImage size={15} />}>
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

              <ControlSection title="界面" icon={<Sparkles size={15} />}>
                <RangeControl
                  label="画面亮度"
                  value={selected.presentation.brightness}
                  min={0.25}
                  max={1.3}
                  step={0.01}
                  format={rangeFormatters.brightness}
                  onChange={(value) => updatePresentation({ brightness: value })}
                />
                <RangeControl
                  label="背景遮罩"
                  value={selected.presentation.overlayOpacity}
                  min={0}
                  max={0.8}
                  step={0.01}
                  format={rangeFormatters.overlayOpacity}
                  onChange={(value) => updatePresentation({ overlayOpacity: value })}
                />
                <RangeControl
                  label="面板不透明度"
                  value={selected.presentation.panelOpacity}
                  min={0.3}
                  max={1}
                  step={0.01}
                  format={rangeFormatters.panelOpacity}
                  onChange={(value) => updatePresentation({ panelOpacity: value })}
                />
                <RangeControl
                  label="玻璃模糊"
                  value={selected.presentation.panelBlur}
                  min={0}
                  max={48}
                  step={1}
                  format={rangeFormatters.panelBlur}
                  onChange={(value) => updatePresentation({ panelBlur: value })}
                />
                <div className="two-controls">
                  <RangeControl
                    label="圆角"
                    value={selected.presentation.radius}
                    min={8}
                    max={26}
                    step={1}
                    format={rangeFormatters.radius}
                    onChange={(value) => updatePresentation({ radius: value })}
                  />
                  <RangeControl
                    label="任务背景"
                    value={selected.presentation.taskIntensity}
                    min={0}
                    max={1}
                    step={0.01}
                    format={rangeFormatters.taskIntensity}
                    onChange={(value) => updatePresentation({ taskIntensity: value })}
                  />
                </div>
              </ControlSection>

              <ControlSection title="色彩" icon={<Palette size={15} />}>
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
                    ["auto", "自动文字"],
                    ["light", "浅色"],
                    ["dark", "深色"],
                  ]}
                  onChange={(value) => updatePresentation({ textTone: value as ThemePresentation["textTone"] })}
                />
              </ControlSection>

              <div className="source-box">
                <span className="source-icon">
                  {selected.source.type === "github" ? <GitBranch size={15} /> : <Archive size={15} />}
                </span>
                <div>
                  <strong>{selected.builtin ? "Skin Studio 内置" : "本地导入"}</strong>
                  <small>{selected.source.adapter === "dream-skin-v1"
                    ? selected.safeCss ? "Dream Skin v1 · Safe CSS" : "Dream Skin v1 · Legacy"
                    : selected.source.label}</small>
                </div>
              </div>
            </div>

            <div className="action-dock">
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
                  {selected.id === data.activeThemeId ? "重新应用" : "应用到 Codex"}
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
              <div className="dock-meta">
                <RuntimeDot state={data.codex.runtime.state} />
                <span>{data.codex.runtime.message}</span>
                {!selected.builtin && (
                  <button
                    title="删除主题"
                    onClick={() => runOperation("delete", () => window.skinStudio.deleteTheme(selected.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
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
  return (
    <div className={`target-card ${state}`}>
      <div className="target-icon"><Monitor size={18} /></div>
      <div className="target-copy">
        <span>目标应用</span>
        <strong>Codex</strong>
        <small>
          {!codex.installation.installed
            ? "未检测到安装"
            : `v${codex.installation.version ?? "未知"} · ${
              codex.runtime.state === "active" ? "已注入" : codex.running ? "运行中" : "未运行"
            }`}
        </small>
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
    "--card-image": `url("${theme.assetUrl}")`,
    "--card-position": `${theme.presentation.positionX}% ${theme.presentation.positionY}%`,
    "--card-size": theme.presentation.fit === "fill" ? "100% 100%" : theme.presentation.fit,
    "--card-brightness": theme.presentation.brightness,
    "--card-scale": theme.presentation.scale,
    "--card-overlay": theme.presentation.overlayOpacity,
    "--card-panel": theme.presentation.panelOpacity,
    "--card-accent": theme.presentation.accent,
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
          <span>{theme.builtin ? "内置" : theme.source.adapter === "dream-skin-v1" ? "Dream Skin" : "本地"}</span>
        </div>
        <span className="accent-swatch" style={{ background: theme.presentation.accent }} />
      </div>
      <p>{theme.description}</p>
    </button>
  );
}

function ThemePreview({ theme }: { theme: ThemeSummary }) {
  const style = {
    "--preview-image": `url("${theme.assetUrl}")`,
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

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented control">
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
  onChoose: (kind: "image" | "theme" | "folder") => void;
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
            <p>只下载公开仓库 ZIP，不执行其中脚本。会扫描 Skin Studio v1 与 Dream Skin v1 主题目录。</p>
            <div className="sheet-actions">
              <button type="button" className="secondary" onClick={() => onMode("image")}>返回</button>
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
                <strong>背景素材</strong>
                <small>PNG、JPG、GIF、WebP</small>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => onChoose("theme")}>
                <span className="import-icon archive"><Archive size={21} /></span>
                <strong>主题 ZIP</strong>
                <small>安全解压并转换主题</small>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => onChoose("folder")}>
                <span className="import-icon folder"><FolderOpen size={21} /></span>
                <strong>项目文件夹</strong>
                <small>扫描本地主题目录</small>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => onMode("github")}>
                <span className="import-icon github"><GitBranch size={21} /></span>
                <strong>GitHub 仓库</strong>
                <small>公开仓库地址</small>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="compatibility-note">
              <ShieldCheck size={17} />
              <p>
                <strong>当前已验证</strong>
                <span>Skin Studio v1、Fei-Away/Codex-Dream-Skin v1 图片与配色转换</span>
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
