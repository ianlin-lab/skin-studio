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
      expect(payload.expression).toContain("native controls out of the web theme's color-scheme");
      expect(payload.expression).toContain("#root,\\nhtml[data-skin-studio-theme] [data-reactroot]");
      expect(payload.expression).toContain(
        '[data-state=\\"checked\\"]:not([role=\\"switch\\"]):not([role=\\"switch\\"] *)',
      );
      expect(payload.expression).toContain(
        '[role=\\"switch\\"] > [data-state=\\"checked\\"]',
      );
      expect(payload.expression).toContain(
        '[role=\\"switch\\"] > [data-state] > [data-state]',
      );
      expect(payload.expression).toContain(
        '[data-ds-part=\\"header\\"] button[class~=\\"bg-token-bg-fog\\"]',
      );
      expect(payload.expression).toContain("color: #22252e !important");
      expect(payload.revision).toHaveLength(18);
      const verification = verifyExpression(theme.id, payload.revision);
      expect(verification).toContain(payload.revision);
      const rootElement = {
        getAttribute: (name: string) => name === "data-skin-studio-theme"
          ? theme.id
          : name === "data-skin-studio-revision" ? payload.revision : null,
      };
      const styleElement = {
        isConnected: true,
        dataset: {
          revision: payload.revision,
          contract: "skin-studio-codex-v2",
        },
      };
      const documentMock = {
        documentElement: rootElement,
        querySelector: (selector: string) => selector.includes("main") || selector.includes("aside")
          ? {}
          : null,
        getElementById: (id: string) => id === "skin-studio-theme-style" ? styleElement : null,
      };
      const verify = Function("document", `return ${verification};`) as (
        document: typeof documentMock,
      ) => { ok: boolean; visualReady: boolean };
      expect(verify(documentMock)).toMatchObject({ ok: true, visualReady: true });
      expect(CLEANUP_EXPRESSION).toContain("removeAttribute");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("uses independent composer and popup opacity overrides when a theme provides them", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-opacity-"));
    const asset = path.join(root, "background.svg");
    await fs.writeFile(asset, "<svg xmlns=\"http://www.w3.org/2000/svg\"/>");
    try {
      const payload = await buildInjectionPayload({
        format: "skin-studio-theme-v1",
        schemaVersion: 1,
        id: "opacity-test",
        name: "Opacity Test",
        description: "test",
        author: "test",
        builtin: false,
        asset: { file: "background.svg", mime: "image/svg+xml", animated: false },
        presentation: { ...DEFAULT_PRESENTATION, composerOpacity: 0.72, popupOpacity: 0.82 },
        source: { type: "image", label: "test" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, asset);
      expect(payload.expression).toContain("rgba(34, 37, 46, 0.720)");
      expect(payload.expression).toContain("rgba(24, 26, 33, 0.820)");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("uses the background scale value for the rendered artwork and motion layout", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-scale-"));
    const asset = path.join(root, "background.svg");
    await fs.writeFile(asset, "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"2\" height=\"2\"/>");
    try {
      const payload = await buildInjectionPayload({
        format: "skin-studio-theme-v1",
        schemaVersion: 1,
        id: "scale-test",
        name: "Scale Test",
        description: "test",
        author: "test",
        builtin: false,
        asset: { file: "background.svg", mime: "image/svg+xml", animated: false },
        presentation: { ...DEFAULT_PRESENTATION, scale: 1.65 },
        source: { type: "image", label: "test" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, asset);
      expect(payload.expression).toContain("const artworkScale = 1.65");
      expect(payload.expression).toContain("--skin-artwork-size");
      expect(payload.expression).toContain("updateArtworkLayout");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("uses a bounded motion layer and keeps the static art when motion is disabled", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-motion-"));
    const asset = path.join(root, "background.png");
    const motion = path.join(root, "person.png");
    await Promise.all([fs.writeFile(asset, "static-art"), fs.writeFile(motion, "person-art")]);
    const manifest: ThemeManifest = {
      format: "skin-studio-theme-v1",
      schemaVersion: 1,
      id: "motion-test",
      name: "Motion Test",
      description: "test",
      author: "test",
      builtin: false,
      asset: {
        file: "background.png",
        mime: "image/png",
        animated: true,
        motion: {
          file: "person.png",
          mime: "image/png",
          canvasWidth: 1000,
          canvasHeight: 700,
          cropX: 300,
          cropY: 100,
          cropWidth: 600,
          cropHeight: 600,
          originX: 500,
          originY: 620,
        },
      },
      presentation: DEFAULT_PRESENTATION,
      source: { type: "image", label: "test" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const active = await buildInjectionPayload(manifest, asset);
      expect(active.expression).toContain("skin-studio-person-float");
      expect(active.expression).toContain("data:image/png;base64,cGVyc29uLWFydA==");
      const staticPayload = await buildInjectionPayload({
        ...manifest,
        presentation: { ...manifest.presentation, motionEnabled: false },
      }, asset);
      expect(staticPayload.expression).not.toContain("skin-studio-person-float");
      expect(staticPayload.expression).toContain("data:image/png;base64,c3RhdGljLWFydA==");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("switches an imported animated background to its generated still asset", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-still-"));
    const asset = path.join(root, "background.gif");
    const still = path.join(root, "background-still.png");
    await Promise.all([fs.writeFile(asset, "animated-art"), fs.writeFile(still, "still-art")]);
    const manifest: ThemeManifest = {
      format: "skin-studio-theme-v1",
      schemaVersion: 1,
      id: "still-test",
      name: "Still Test",
      description: "test",
      author: "test",
      builtin: false,
      asset: {
        file: "background.gif",
        mime: "image/gif",
        animated: true,
        still: { file: "background-still.png", mime: "image/png" },
      },
      presentation: { ...DEFAULT_PRESENTATION, motionEnabled: true },
      source: { type: "image", label: "test" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const active = await buildInjectionPayload(manifest, asset);
      expect(active.expression).toContain("data:image/gif;base64,YW5pbWF0ZWQtYXJ0");
      const staticPayload = await buildInjectionPayload({
        ...manifest,
        presentation: { ...manifest.presentation, motionEnabled: false },
      }, asset);
      expect(staticPayload.expression).toContain("data:image/png;base64,c3RpbGwtYXJ0");
      expect(staticPayload.expression).not.toContain("data:image/gif;base64,YW5pbWF0ZWQtYXJ0");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
