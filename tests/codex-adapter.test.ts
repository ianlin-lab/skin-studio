import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InjectionPayload } from "../src/main/adapters/injected-theme";

const evaluateCodexTargets = vi.hoisted(() => vi.fn());

vi.mock("../src/main/adapters/cdp-client", () => ({
  evaluateCodexTargets,
  isCodexCdp: vi.fn(),
  waitForCodexCdp: vi.fn(),
}));

import { injectThemeWhenReady } from "../src/main/adapters/codex-adapter";

describe("Codex restart injection", () => {
  beforeEach(() => {
    evaluateCodexTargets.mockReset();
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
