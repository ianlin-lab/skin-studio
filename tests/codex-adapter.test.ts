import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InjectionPayload } from "../src/main/adapters/injected-theme";

const evaluateCodexTargets = vi.hoisted(() => vi.fn());
const isCodexCdp = vi.hoisted(() => vi.fn());

vi.mock("../src/main/adapters/cdp-client", () => ({
  evaluateCodexTargets,
  isCodexCdp,
  waitForCodexCdp: vi.fn(),
}));

import { CodexAdapter, injectThemeWhenReady } from "../src/main/adapters/codex-adapter";

describe("Codex restart injection", () => {
  beforeEach(() => {
    evaluateCodexTargets.mockReset();
    isCodexCdp.mockReset();
  });

  it("waits for the main UI instead of failing the first incomplete frame", async () => {
    const payload: InjectionPayload = {
      expression: "apply-theme",
      revision: "revision-1",
    };
    evaluateCodexTargets
      .mockResolvedValueOnce([{ ok: false }])
      .mockResolvedValueOnce([{ ok: false, visualReady: false }])
      .mockResolvedValueOnce([{ ok: true }])
      .mockResolvedValueOnce([{ ok: true, visualReady: true }]);

    await expect(injectThemeWhenReady(9362, "aurora-glass", payload, 2_000))
      .resolves.toBe(1);
    expect(evaluateCodexTargets).toHaveBeenCalledTimes(4);
  });
});

describe("appearance-only restore", () => {
  async function withState(run: (adapter: CodexAdapter, statePath: string) => Promise<void>) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-restore-"));
    const statePath = path.join(directory, "codex-runtime.json");
    await fs.writeFile(statePath, JSON.stringify({
      version: 1,
      state: "active",
      activeThemeId: "claude-warm",
      port: 9341,
      managedLaunch: true,
      codexPid: 1234,
      bundlePath: "/Applications/ChatGPT.app",
      executablePath: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
      revision: "old",
      injectedTargets: 1,
      appliedThemeUpdatedAt: "2026-10-16T00:00:00Z",
      updatedAt: "2026-10-16T00:00:00Z",
    }));
    try {
      await run(new CodexAdapter(directory), statePath);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }

  beforeEach(() => {
    evaluateCodexTargets.mockReset();
    isCodexCdp.mockReset();
  });

  it("cleans the theme without closing ChatGPT and retains a reusable local port", async () => {
    await withState(async (adapter, statePath) => {
      isCodexCdp.mockResolvedValue(true);
      evaluateCodexTargets.mockResolvedValue([{ ok: true, stock: true }]);
      vi.spyOn(adapter, "detect").mockResolvedValue({} as Awaited<ReturnType<CodexAdapter["detect"]>>);
      const kill = vi.spyOn(process, "kill");
      try {
        const result = await adapter.restore();
        const state = JSON.parse(await fs.readFile(statePath, "utf8"));
        expect(result).toMatchObject({ ok: true, activeThemeId: null });
        expect(state).toMatchObject({ state: "stock", activeThemeId: null, port: 9341, managedLaunch: true });
        expect(kill).not.toHaveBeenCalled();
      } finally {
        kill.mockRestore();
      }
    });
  });

  it("does not claim success or erase state when cleanup fails", async () => {
    await withState(async (adapter, statePath) => {
      isCodexCdp.mockResolvedValue(true);
      evaluateCodexTargets.mockRejectedValue(new Error("renderer unavailable"));
      vi.spyOn(adapter, "detect").mockResolvedValue({} as Awaited<ReturnType<CodexAdapter["detect"]>>);
      const result = await adapter.restore();
      const state = JSON.parse(await fs.readFile(statePath, "utf8"));
      expect(result.ok).toBe(false);
      expect(result.message).toContain("未重启");
      expect(state).toMatchObject({ state: "active", activeThemeId: "claude-warm" });
    });
  });
});
