#!/usr/bin/env node

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile: execFileCallback } = require("node:child_process");
const { promisify } = require("node:util");

const execFile = promisify(execFileCallback);
const candidates = [
  process.env.SKIN_STUDIO_DATA_DIR && path.join(process.env.SKIN_STUDIO_DATA_DIR, "codex-runtime.json"),
  path.join(os.homedir(), "Library", "Application Support", "Skin Studio", "data", "codex-runtime.json"),
  path.join(os.homedir(), "Library", "Application Support", "skin-studio", "data", "codex-runtime.json"),
].filter(Boolean);

async function readState() {
  for (const statePath of candidates) {
    try {
      return { statePath, state: JSON.parse(await fs.readFile(statePath, "utf8")) };
    } catch {
      // Try the next known user-data location.
    }
  }
  throw new Error("没有找到 Skin Studio 的 Codex 运行状态；未执行任何进程操作");
}

async function processCommand(pid) {
  const result = await execFile("/bin/ps", ["-p", String(pid), "-o", "command="], { timeout: 3_000 });
  return result.stdout.trim();
}

async function findManagedPid(executablePath, port) {
  const result = await execFile("/bin/ps", ["-axo", "pid=,command="], { timeout: 3_000 });
  const portArgument = `--remote-debugging-port=${port}`;
  const matches = result.stdout.split("\n").flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) return [];
    const command = match[2];
    if (
      !command.startsWith(executablePath)
      || command.includes("--type=")
      || !command.split(/\s+/).includes(portArgument)
    ) return [];
    return [{ pid: Number(match[1]), command }];
  });
  if (matches.length > 1) throw new Error("发现多个匹配的主题会话；为安全起见拒绝结束进程");
  return matches[0] || null;
}

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  const { statePath, state } = await readState();
  let pid = Number(state.codexPid);
  const executablePath = typeof state.executablePath === "string" ? state.executablePath : "";
  const bundlePath = typeof state.bundlePath === "string" ? state.bundlePath : "";
  const port = Number(state.port);
  if (!state.managedLaunch || !Number.isInteger(port) || port < 1024 || !executablePath || !bundlePath) {
    throw new Error("状态中没有由 Skin Studio 管理的 Codex 会话；未执行任何进程操作");
  }
  let command = "";
  const managed = await findManagedPid(executablePath, port);
  if (managed) {
    pid = managed.pid;
    command = managed.command;
  } else if (Number.isInteger(pid) && pid >= 2) {
    try {
      command = await processCommand(pid);
    } catch {
      // Already closed is safe; continue to normal launch.
    }
  }
  if (
    command
    && (
      !command.startsWith(executablePath)
      || !command.split(/\s+/).includes(`--remote-debugging-port=${port}`)
    )
  ) {
    throw new Error(`记录的 PID ${pid} 不再是该主题会话；为安全起见拒绝结束它`);
  }
  if (command) {
    process.kill(pid, "SIGTERM");
    if (!(await waitForExit(pid, 9_000))) {
      throw new Error("Codex 未在 9 秒内正常退出；未使用强制结束");
    }
  }
  await execFile("/usr/bin/open", ["-na", bundlePath], { timeout: 8_000 });
  const stock = {
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
    updatedAt: new Date().toISOString(),
  };
  const temporary = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(stock, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, statePath);
  process.stdout.write("Codex 已按原生方式重新启动，Skin Studio 运行状态已重置。\n");
}

main().catch((error) => {
  process.stderr.write(`恢复失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
