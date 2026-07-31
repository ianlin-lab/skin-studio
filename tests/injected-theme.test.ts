import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ThemeManifest } from "../src/shared/types";
import {
  CLEANUP_EXPRESSION,
  buildInjectionPayload,
  verifyExpression,
} from "../src/main/adapters/injected-theme";
import { DEFAULT_PRESENTATION } from "../src/main/core/theme-utils";

describe("injected theme payload", () => {
  it("embeds local art, a scoped style id, verification, and cleanup", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-payload-"));
    const asset = path.join(root, "background.svg");
    await fs.writeFile(asset, "<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"2\" height=\"2\"/></svg>");
    const theme: ThemeManifest = {
      format: "skin-studio-theme-v1",
      schemaVersion: 1,
      id: "payload-test",
      name: "Payload Test",
      description: "test",
      author: "test",
      builtin: false,
      asset: { file: "background.svg", mime: "image/svg+xml", animated: false },
      presentation: DEFAULT_PRESENTATION,
      source: { type: "image", label: "test" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const payload = await buildInjectionPayload(theme, asset);
      expect(payload.expression).toContain("skin-studio-theme-style");
      expect(payload.expression).toContain("skin-studio-codex-v2");
      expect(payload.expression).toContain("data:image/svg+xml;base64");
      expect(payload.expression).toContain("data-ds-part");
      expect(payload.expression).toContain("composer-surface-chrome");
      expect(payload.expression).toContain("--ds-theme-color-accent");
      expect(payload.expression).toContain(
        '[data-state=\\"checked\\"]:not([role=\\"switch\\"]):not([role=\\"switch\\"] *)',
      );
      expect(payload.expression).toContain(
        '[role=\\"switch\\"] > [data-state=\\"checked\\"]',
      );
      expect(payload.expression).toContain(
        '[role=\\"switch\\"] > [data-state] > [data-state]',
      );
      expect(payload.revision).toHaveLength(18);
      expect(verifyExpression(theme.id, payload.revision)).toContain(payload.revision);
      expect(CLEANUP_EXPRESSION).toContain("removeAttribute");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
