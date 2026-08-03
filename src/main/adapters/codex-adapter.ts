import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  CodexInstallation,
  CodexStatus,
  OperationResult,
  ThemeManifest,
} from "../../shared/types";
import { writeJsonAtomic } from "../core/theme-utils";
import {
  evaluateCodexTargets,
  isCodexCdp,
  waitForCodexCdp,
} from "./cdp-client";
import {
  CLEANUP_EXPRESSION,
  buildInjectionPayload,
  verifyExpression,
  type InjectionPayload,
} from "./injected-theme";
import { RestartRequiredError, type TargetAdapter } from "./target-adapter";

const execFile = promisify(execFileCallback);

interface RuntimeState {
  version: 1;
  state: "active" | "stock" | "stale";
  activeThemeId: string | null;
  port: number | null;
  managedLaunch: boolean;
  codexPid: number | null;
  bundlePath: string | null;
  executablePath: string | null;
  revision: string | null;
  injectedTargets: number;
  appliedThemeUpdatedAt: string | null;
  updatedAt: string;
  lastError?: string;
}

const STOCK_STATE: RuntimeState = {
  version: 1,
  state: "stock",
  activeThemeId: null,
  port: null,
  managedLaunch: false,
  codexPid: null,
  bundlePath: null,
  executablePath: null,
  revision: null,
  injectedTargets: 0,
  appliedThemeUpdatedAt: null,
  updatedAt: new Date(0).toISOString(),
};

export async function injectThemeWhenReady(
  port: number,
  themeId: string,
  payload: InjectionPayload,
  timeoutMs = 24_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let sawRenderer = false;
  let verifiedCount = 0;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const results = await evaluateCodexTargets(port, payload.expression);
      sawRenderer ||= results.length > 0;
      if (results.length) {
        const verified = await evaluateCodexTargets(
          port,
          verifyExpression(themeId, payload.revision),
        );
        verifiedCount = verified.filter((item) => (item as { ok?: boolean })?.ok).length;
        if (verifiedCount > 0) return verifiedCount;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  await evaluateCodexTargets(port, CLEANUP_EXPRESSION).catch(() => undefined);
  const detail = lastError instanceof Error ? `：${lastError.message}` : "";
  throw new Error(
    sawRenderer
      ? `Codex 主界面在 ${Math.ceil(timeoutMs / 1_000)} 秒内未就绪，已回滚本次注入${detail}`
      : `没有找到可注入的 Codex 窗口，已回滚本次注入${detail}`,
  );
}

export class CodexAdapter implements TargetAdapter {
  readonly id = "codex-cdp-v1";
  private readonly statePath: string;
  private watchTimer: NodeJS.Timeout | null = null;
  private watchBusy = false;
  private activeTheme: { themeId: string; payload: InjectionPayload } | null = null;

  constructor(stateDirectory: string) {
    this.statePath = path.join(stateDirectory, "codex-runtime.json");
  }

  async detect(): Promise<CodexStatus> {
    const installation = await this.detectInstallation();
    const processIds = installation.executablePath
      ? await this.findMainProcessIds(installation.executablePath)
      : [];
    const state = await this.readState();
    let runtimeState: CodexStatus["runtime"]["state"] = state.state;
    let message = "Codex 使用原生界面";
    let injectedTargets = state.injectedTargets;
    if (state.port && state.activeThemeId) {
      const alive = await isCodexCdp(state.port);
      if (alive) {
        runtimeState = "active";
        message = `主题会话运行于 127.0.0.1:${state.port}`;
      } else {
        runtimeState = "stale";
        injectedTargets = 0;
        message = "主题状态已失联，可重新应用或恢复默认";
      }
    } else if (state.lastError) {
      runtimeState = "stale";
      message = state.lastError;
    }
    return {
      installation,
      running: processIds.length > 0,
      processIds,
      runtime: {
        state: runtimeState,
        activeThemeId: state.activeThemeId,
        port: state.port,
        managedLaunch: state.managedLaunch,
        injectedTargets,
        appliedThemeUpdatedAt: state.appliedThemeUpdatedAt,
        message,
      },
    };
  }

  async apply(
    theme: ThemeManifest,
    assetPath: string,
    allowRestart = false,
  ): Promise<OperationResult> {
    const installation = await this.detectInstallation();
    if (!installation.installed || !installation.bundlePath || !installation.executablePath) {
      return { ok: false, message: "没有找到官方 Codex 桌面应用" };
    }
    const previous = await this.readState();
    if (previous.port && await isCodexCdp(previous.port)) {
      return this.applyOnPort(theme, assetPath, previous.port, previous);
    }
    const currentPids = await this.findMainProcessIds(installation.executablePath);
    if (currentPids.length && !allowRestart) {
      throw new RestartRequiredError("Codex 当前未开启本机调试端口，应用主题需要安全重启一次");
    }
    if (currentPids.length) {
      await this.terminateVerifiedPids(currentPids, installation.executablePath);
    }
    const port = await this.selectLoopbackPort();
    let launchedPid: number | null = null;
    try {
      await execFile("/usr/bin/open", [
        "-na",
        installation.bundlePath,
        "--args",
        "--remote-debugging-address=127.0.0.1",
        `--remote-debugging-port=${port}`,
      ], { timeout: 8_000 });
      await waitForCodexCdp(port, 20_000);
      const launchedPids = await this.findMainProcessIds(installation.executablePath);
      launchedPid = launchedPids[0] ?? null;
      const state: RuntimeState = {
        version: 1,
        state: "active",
        activeThemeId: theme.id,
        port,
        managedLaunch: true,
        codexPid: launchedPid,
        bundlePath: installation.bundlePath,
        executablePath: installation.executablePath,
        revision: null,
        injectedTargets: 0,
        appliedThemeUpdatedAt: null,
        updatedAt: new Date().toISOString(),
      };
      return await this.applyOnPort(theme, assetPath, port, state);
    } catch (error) {
      await this.rollbackFailedLaunch({
        bundlePath: installation.bundlePath,
        executablePath: installation.executablePath,
        port,
        launchedPid,
      });
      const message = `应用失败，已尝试恢复原生启动：${error instanceof Error ? error.message : String(error)}`;
      await this.writeState({ ...STOCK_STATE, state: "stale", lastError: message, updatedAt: new Date().toISOString() });
      return { ok: false, message, codex: await this.detect() };
    }
  }

  async reapply(theme: ThemeManifest, assetPath: string): Promise<OperationResult> {
    const state = await this.readState();
    if (!state.port || !(await isCodexCdp(state.port))) {
      return this.apply(theme, assetPath, true);
    }
    return this.applyOnPort(theme, assetPath, state.port, state);
  }

  async restore(): Promise<OperationResult> {
    this.stopWatch();
    const state = await this.readState();
    let cleanupMessage = "已移除 Skin Studio 注入";
    if (state.port && await isCodexCdp(state.port)) {
      try {
        await evaluateCodexTargets(state.port, CLEANUP_EXPRESSION);
      } catch (error) {
        cleanupMessage = `清理注入时收到警告：${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (state.managedLaunch && state.executablePath && state.bundlePath) {
      const managed = state.port
        ? await this.findManagedProcessIds(state.executablePath, state.port)
        : [];
      const candidates = state.codexPid && managed.includes(state.codexPid)
        ? [state.codexPid]
        : managed;
      if (candidates.length) {
        await this.terminateVerifiedPids(candidates, state.executablePath);
      }
      await execFile("/usr/bin/open", ["-na", state.bundlePath], { timeout: 8_000 });
      cleanupMessage = "已恢复 Codex 原生界面，并关闭本机调试会话";
    }
    await this.writeState({ ...STOCK_STATE, updatedAt: new Date().toISOString() });
    this.activeTheme = null;
    return {
      ok: true,
      message: cleanupMessage,
      activeThemeId: null,
      codex: await this.detect(),
    };
  }

  dispose(): void {
    this.stopWatch();
  }

  async resume(theme: ThemeManifest, assetPath: string): Promise<void> {
    const state = await this.readState();
    if (state.activeThemeId === theme.id && state.port && await isCodexCdp(state.port)) {
      this.startWatch(theme.id, await buildInjectionPayload(theme, assetPath), state.port);
    }
  }

  private async applyOnPort(
    theme: ThemeManifest,
    assetPath: string,
    port: number,
    state: RuntimeState,
  ): Promise<OperationResult> {
    const payload = await buildInjectionPayload(theme, assetPath);
    const verifiedCount = await injectThemeWhenReady(port, theme.id, payload);
    const next: RuntimeState = {
      ...state,
      state: "active",
      activeThemeId: theme.id,
      port,
      revision: payload.revision,
      injectedTargets: verifiedCount,
      appliedThemeUpdatedAt: theme.updatedAt,
      updatedAt: new Date().toISOString(),
      lastError: undefined,
    };
    await this.writeState(next);
    this.startWatch(theme.id, payload, port);
    return {
      ok: true,
      message: verifiedCount > 1 ? `主题已应用到 ${verifiedCount} 个 Codex 窗口` : "主题已应用到 Codex",
      activeThemeId: theme.id,
      codex: await this.detect(),
    };
  }

  private startWatch(themeId: string, payload: InjectionPayload, port: number): void {
    this.stopWatch();
    this.activeTheme = { themeId, payload };
    this.watchTimer = setInterval(async () => {
      if (this.watchBusy || !this.activeTheme) return;
      this.watchBusy = true;
      try {
        const checks = await evaluateCodexTargets(
          port,
          verifyExpression(this.activeTheme.themeId, this.activeTheme.payload.revision),
        );
        if (!checks.length || checks.some((item) => !(item as { ok?: boolean })?.ok)) {
          await evaluateCodexTargets(port, this.activeTheme.payload.expression);
        }
      } catch {
        // A short renderer reload or Codex shutdown is expected; status polling reports it.
      } finally {
        this.watchBusy = false;
      }
    }, 2_500);
    this.watchTimer.unref();
  }

  private stopWatch(): void {
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.watchTimer = null;
    this.watchBusy = false;
  }

  private async detectInstallation(): Promise<CodexInstallation> {
    const candidates = [
      process.env.CODEX_APP_PATH,
      "/Applications/ChatGPT.app",
      "/Applications/Codex.app",
      path.join(os.homedir(), "Applications", "ChatGPT.app"),
      path.join(os.homedir(), "Applications", "Codex.app"),
    ].filter((item): item is string => Boolean(item));
    for (const bundlePath of candidates) {
      const executableName = await this.plistValue(bundlePath, "CFBundleExecutable");
      const bundleId = await this.plistValue(bundlePath, "CFBundleIdentifier");
      if (!executableName || bundleId !== "com.openai.codex") continue;
      const executablePath = path.join(bundlePath, "Contents", "MacOS", executableName);
      try {
        await fs.access(executablePath, fs.constants.X_OK);
      } catch {
        continue;
      }
      const version = await this.plistValue(bundlePath, "CFBundleShortVersionString");
      let architecture: string | null = null;
      try {
        const result = await execFile("/usr/bin/file", [executablePath], { timeout: 2_000 });
        architecture = result.stdout.includes("arm64") ? "arm64" : result.stdout.trim();
      } catch {
        // Metadata remains useful without architecture.
      }
      return {
        installed: true,
        bundlePath,
        executablePath,
        bundleId,
        version,
        architecture,
      };
    }
    return {
      installed: false,
      bundlePath: null,
      executablePath: null,
      bundleId: null,
      version: null,
      architecture: null,
    };
  }

  private async plistValue(bundlePath: string, key: string): Promise<string | null> {
    try {
      const result = await execFile("/usr/libexec/PlistBuddy", [
        "-c",
        `Print :${key}`,
        path.join(bundlePath, "Contents", "Info.plist"),
      ], { timeout: 2_000 });
      return result.stdout.trim() || null;
    } catch {
      return null;
    }
  }

  private async findMainProcessIds(executablePath: string): Promise<number[]> {
    return (await this.findMainProcesses(executablePath)).map((item) => item.pid);
  }

  private async findManagedProcessIds(executablePath: string, port: number): Promise<number[]> {
    const portArgument = `--remote-debugging-port=${port}`;
    return (await this.findMainProcesses(executablePath))
      .filter((item) => item.command.split(/\s+/).includes(portArgument))
      .map((item) => item.pid);
  }

  private async findMainProcesses(executablePath: string): Promise<Array<{ pid: number; command: string }>> {
    try {
      const result = await execFile("/bin/ps", ["-axo", "pid=,command="], { timeout: 3_000 });
      return result.stdout.split("\n").flatMap((line) => {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (!match) return [];
        const command = match[2];
        if (!command.startsWith(executablePath) || command.includes("--type=")) return [];
        return [{ pid: Number(match[1]), command }];
      });
    } catch {
      return [];
    }
  }

  private async terminateVerifiedPids(pids: number[], executablePath: string): Promise<void> {
    const verified = new Set(await this.findMainProcessIds(executablePath));
    const targets = pids.filter((pid) => verified.has(pid));
    if (!targets.length) return;
    for (const pid of targets) {
      try {
        process.kill(pid, "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    const deadline = Date.now() + 9_000;
    while (Date.now() < deadline) {
      const alive = new Set(await this.findMainProcessIds(executablePath));
      if (targets.every((pid) => !alive.has(pid))) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Codex 未在 9 秒内安全退出；未强制结束进程");
  }

  private async selectLoopbackPort(): Promise<number> {
    for (let port = 9341; port <= 9398; port += 1) {
      const available = await new Promise<boolean>((resolve) => {
        const server = net.createServer();
        server.unref();
        server.once("error", () => resolve(false));
        server.listen(port, "127.0.0.1", () => {
          server.close(() => resolve(true));
        });
      });
      if (available) return port;
    }
    throw new Error("没有可用的本机调试端口");
  }

  private async rollbackFailedLaunch(options: {
    bundlePath: string;
    executablePath: string;
    port: number;
    launchedPid: number | null;
  }): Promise<void> {
    try {
      if (await isCodexCdp(options.port)) {
        await evaluateCodexTargets(options.port, CLEANUP_EXPRESSION).catch(() => undefined);
      }
      const managed = await this.findManagedProcessIds(options.executablePath, options.port);
      const candidates = options.launchedPid && managed.includes(options.launchedPid)
        ? [options.launchedPid]
        : managed;
      if (candidates.length) {
        await this.terminateVerifiedPids(candidates, options.executablePath);
      }
      await execFile("/usr/bin/open", ["-na", options.bundlePath], { timeout: 8_000 });
    } catch {
      // Preserve the original error; runtime state records that recovery is unconfirmed.
    }
  }

  private async readState(): Promise<RuntimeState> {
    try {
      const raw = JSON.parse(await fs.readFile(this.statePath, "utf8")) as Partial<RuntimeState>;
      if (raw.version !== 1) return STOCK_STATE;
      return { ...STOCK_STATE, ...raw };
    } catch {
      return STOCK_STATE;
    }
  }

  private async writeState(state: RuntimeState): Promise<void> {
    await writeJsonAtomic(this.statePath, state);
  }
}
