import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  ipcMain,
  protocol,
  shell,
  type OpenDialogOptions,
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  DashboardData,
  ImportResult,
  OperationResult,
  StudioSettings,
  ThemePatch,
} from "../shared/types";
import { CodexAdapter } from "./adapters/codex-adapter";
import { RestartRequiredError } from "./adapters/target-adapter";
import { resolveBundledThemesDirectory } from "./core/runtime-paths";
import { ThemeRepository } from "./core/theme-repository";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "skin-studio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let repository: ThemeRepository;
let codexAdapter: CodexAdapter;
const singleInstanceLockAcquired = app.requestSingleInstanceLock();

if (!singleInstanceLockAcquired) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function dataDirectory(): string {
  return process.env.SKIN_STUDIO_DATA_DIR || path.join(app.getPath("userData"), "data");
}

async function dashboard(): Promise<DashboardData> {
  const [themes, codex, settings] = await Promise.all([
    repository.list(),
    codexAdapter.detect(),
    repository.getSettings(),
  ]);
  return {
    themes,
    codex,
    settings,
    activeThemeId: codex.runtime.activeThemeId,
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 850,
    minWidth: 1080,
    minHeight: 720,
    title: "Skin Studio",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#101116",
    vibrancy: "under-window",
    visualEffectState: "active",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) console.error("Renderer console", { message, line, sourceId });
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    void mainWindow.loadURL(devServer).catch((error) => console.error("Failed to load dev renderer", error));
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"))
      .catch((error) => console.error("Failed to load packaged renderer", error));
  }
}

function registerIpc(): void {
  ipcMain.handle("studio:bootstrap", () => dashboard());
  ipcMain.handle("studio:status", () => codexAdapter.detect());
  ipcMain.handle("studio:update-settings", async (_event, patch: Partial<StudioSettings>) => (
    repository.updateSettings(patch)
  ));

  ipcMain.handle("theme:choose-import", async (_event, kind: "image" | "folder") => {
    if (!mainWindow) return { ok: false, message: "窗口不可用" } satisfies ImportResult;
    const options: OpenDialogOptions = kind === "folder"
      ? {
          title: "选择已解压的主题文件夹",
          properties: ["openDirectory"],
        }
      : {
          title: "选择背景素材",
          properties: ["openFile"],
          filters: [{ name: "图片与动态素材", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
        };
    const selected = await dialog.showOpenDialog(mainWindow, options);
    if (selected.canceled || !selected.filePaths[0]) {
      return { ok: false, message: "已取消导入" } satisfies ImportResult;
    }
    try {
      return await repository.importPath(selected.filePaths[0], kind === "folder" ? "folder" : "image");
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      } satisfies ImportResult;
    }
  });

  ipcMain.handle("theme:import-github", async (_event, url: string) => {
    try {
      return await repository.importGithub(url);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      } satisfies ImportResult;
    }
  });

  ipcMain.handle("theme:update", async (_event, id: string, patch: ThemePatch) => (
    repository.update(id, patch)
  ));

  ipcMain.handle("theme:delete", async (_event, id: string) => {
    if (!mainWindow) return { ok: false, message: "窗口不可用" } satisfies OperationResult;
    const theme = await repository.get(id);
    if (theme.builtin) return { ok: false, message: "内置主题不能删除" } satisfies OperationResult;
    const status = await codexAdapter.detect();
    if (status.runtime.activeThemeId === id) {
      return { ok: false, message: "请先恢复默认或切换到其他主题" } satisfies OperationResult;
    }
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "删除主题",
      message: `将「${theme.name}」移到废纸篓？`,
      detail: "Codex 项目和对话不会受到影响。",
      buttons: ["移到废纸篓", "取消"],
      defaultId: 1,
      cancelId: 1,
    });
    if (confirmation.response !== 0) {
      return { ok: false, message: "已取消删除" } satisfies OperationResult;
    }
    await shell.trashItem(repository.resolveThemeDir(id));
    return {
      ok: true,
      message: "主题已移到废纸篓",
      themes: await repository.list(),
    } satisfies OperationResult;
  });

  ipcMain.handle("theme:reveal", async (_event, id: string) => {
    await shell.showItemInFolder(repository.resolveThemeDir(id));
  });

  ipcMain.handle("codex:apply", async (_event, id: string) => {
    const theme = await repository.getManifest(id);
    const assetPath = await repository.resolveAssetPath(id);
    try {
      return await codexAdapter.apply(theme, assetPath, false);
    } catch (error) {
      if (!(error instanceof RestartRequiredError) || !mainWindow) throw error;
      const confirmation = await dialog.showMessageBox(mainWindow, {
        type: "question",
        title: "重启 Codex 并应用主题",
        message: "Codex 需要安全重启一次",
        detail: "Skin Studio 会先请求 Codex 正常退出，再用仅绑定 127.0.0.1 的本机调试会话启动。请先保存输入框中尚未发送的内容。",
        buttons: ["重启并应用", "取消"],
        defaultId: 0,
        cancelId: 1,
      });
      if (confirmation.response !== 0) {
        return { ok: false, message: "已取消应用，Codex 未发生变化" } satisfies OperationResult;
      }
      return codexAdapter.apply(theme, assetPath, true);
    }
  });

  ipcMain.handle("codex:reapply", async () => {
    const status = await codexAdapter.detect();
    if (!status.runtime.activeThemeId) {
      return { ok: false, message: "当前没有可重新应用的主题" } satisfies OperationResult;
    }
    const theme = await repository.getManifest(status.runtime.activeThemeId);
    const assetPath = await repository.resolveAssetPath(theme.id);
    return codexAdapter.reapply(theme, assetPath);
  });

  ipcMain.handle("codex:restore", () => codexAdapter.restore());
}

async function registerAssetProtocol(): Promise<void> {
  protocol.handle("skin-studio", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "asset") return new Response("Not found", { status: 404 });
    const themeId = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    try {
      const theme = await repository.get(themeId);
      const assetPath = await repository.resolveAssetPath(themeId);
      const bytes = await fs.readFile(assetPath);
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": theme.asset.mime,
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

async function resumeRuntime(): Promise<void> {
  const status = await codexAdapter.detect();
  if (!status.runtime.activeThemeId) return;
  try {
    const theme = await repository.getManifest(status.runtime.activeThemeId);
    const assetPath = await repository.resolveAssetPath(theme.id);
    await codexAdapter.resume(theme, assetPath);
  } catch {
    // The dashboard exposes stale state and lets the user recover explicitly.
  }
}

if (singleInstanceLockAcquired) {
  void app.whenReady().then(async () => {
    repository = new ThemeRepository(
      dataDirectory(),
      resolveBundledThemesDirectory(app.getAppPath(), app.isPackaged),
    );
    await repository.initialize();
    codexAdapter = new CodexAdapter(dataDirectory());
    await registerAssetProtocol();
    registerIpc();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: "Skin Studio",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "编辑",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "窗口",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          { role: "front" },
        ],
      },
    ]));
    createWindow();
    await resumeRuntime();

    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  codexAdapter?.dispose();
});
