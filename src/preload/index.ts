import { contextBridge, ipcRenderer } from "electron";
import type {
  DashboardData,
  ImportResult,
  OperationResult,
  SkinStudioApi,
  StudioSettings,
  ThemePatch,
  ThemeSummary,
  CodexStatus,
} from "../shared/types";

const api: SkinStudioApi = {
  bootstrap: () => ipcRenderer.invoke("studio:bootstrap") as Promise<DashboardData>,
  refreshStatus: () => ipcRenderer.invoke("studio:status") as Promise<CodexStatus>,
  chooseAndImport: (kind) => ipcRenderer.invoke("theme:choose-import", kind) as Promise<ImportResult>,
  importGithub: (url) => ipcRenderer.invoke("theme:import-github", url) as Promise<ImportResult>,
  updateTheme: (id: string, patch: ThemePatch) =>
    ipcRenderer.invoke("theme:update", id, patch) as Promise<ThemeSummary>,
  deleteTheme: (id: string) => ipcRenderer.invoke("theme:delete", id) as Promise<OperationResult>,
  applyTheme: (id: string) => ipcRenderer.invoke("codex:apply", id) as Promise<OperationResult>,
  reapplyTheme: () => ipcRenderer.invoke("codex:reapply") as Promise<OperationResult>,
  restoreCodex: () => ipcRenderer.invoke("codex:restore") as Promise<OperationResult>,
  updateSettings: (patch: Partial<StudioSettings>) =>
    ipcRenderer.invoke("studio:update-settings", patch) as Promise<StudioSettings>,
  revealTheme: (id: string) => ipcRenderer.invoke("theme:reveal", id) as Promise<void>,
};

contextBridge.exposeInMainWorld("skinStudio", api);
