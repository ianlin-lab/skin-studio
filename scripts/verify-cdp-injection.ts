import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  captureCodexTargets,
  evaluateCodexTargets,
  waitForCodexCdp,
} from "../src/main/adapters/cdp-client";
import { injectThemeWhenReady } from "../src/main/adapters/codex-adapter";
import {
  CLEANUP_EXPRESSION,
  buildInjectionPayload,
  verifyExpression,
} from "../src/main/adapters/injected-theme";
import { BUILTIN_THEMES } from "../src/main/core/builtin-themes";
import { DEFAULT_PRESENTATION } from "../src/main/core/theme-utils";
import type { ThemeManifest } from "../src/shared/types";

async function main() {
  const portIndex = process.argv.indexOf("--port");
  const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 0);
  const screenshotIndex = process.argv.indexOf("--screenshot");
  const screenshotPath = screenshotIndex >= 0
    ? path.resolve(process.argv[screenshotIndex + 1] || "")
    : undefined;
  const useBuiltin = process.argv.includes("--builtin");
  if (!Number.isInteger(port) || port < 1024) {
    throw new Error(
      "Usage: npm run verify:cdp -- --port <loopback-cdp-port> [--screenshot <png-path>]",
    );
  }
  await waitForCodexCdp(port, 8_000);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skin-studio-cdp-check-"));
  const asset = path.join(root, "background.svg");
  const verificationTheme: ThemeManifest = {
    format: "skin-studio-theme-v1",
    schemaVersion: 1,
    id: "skin-studio-verification",
    name: "Skin Studio Verification",
    description: "Temporary integration theme",
    author: "Skin Studio",
    builtin: false,
    asset: { file: "background.svg", mime: "image/svg+xml", animated: false },
    presentation: {
      ...DEFAULT_PRESENTATION,
      appearance: "dark",
      accent: "#67dfaa",
      colors: {
        ...DEFAULT_PRESENTATION.colors,
        accent: "#67dfaa",
        accentAlt: "#8e7dff",
      },
    },
    source: { type: "builtin", label: "Temporary verification" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const builtinTheme = BUILTIN_THEMES[0];
  let theme = verificationTheme;
  let assetContents = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1200"><defs><linearGradient id="g"><stop stop-color="#071a17"/><stop offset="1" stop-color="#343067"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  if (useBuiltin) {
    if (!builtinTheme) throw new Error("当前没有可用于验证的内置主题");
    if (!builtinTheme.svg) throw new Error("当前验证主题没有内联 SVG 素材");
    theme = structuredClone(builtinTheme.manifest);
    assetContents = builtinTheme.svg;
  }
  let injectionAttempted = false;
  let cleaned: unknown[] = [];
  try {
    await fs.writeFile(asset, assetContents);
    const payload = await buildInjectionPayload(theme, asset);
    injectionAttempted = true;
    const readyCount = await injectThemeWhenReady(port, theme.id, payload, 24_000);
    const applied = await evaluateCodexTargets(
      port,
      verifyExpression(theme.id, payload.revision),
    );
    const reapplied = await evaluateCodexTargets(port, payload.expression);
    const verified = await evaluateCodexTargets(port, verifyExpression(theme.id, payload.revision));
    let screenshots: string[] = [];
    if (screenshotPath) {
      const captures = await captureCodexTargets(port);
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      screenshots = await Promise.all(captures.map(async (capture, index) => {
        const output = captures.length === 1
          ? screenshotPath
          : screenshotPath.replace(/(\.png)?$/i, `-${index + 1}.png`);
        await fs.writeFile(output, capture);
        return output;
      }));
    }
    cleaned = await evaluateCodexTargets(port, CLEANUP_EXPRESSION);
    let restoreScreenshots: string[] = [];
    if (screenshotPath) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const captures = await captureCodexTargets(port);
      restoreScreenshots = await Promise.all(captures.map(async (capture, index) => {
        const suffix = captures.length === 1 ? "-restored" : `-restored-${index + 1}`;
        const output = screenshotPath.replace(/(\.png)?$/i, `${suffix}.png`);
        await fs.writeFile(output, capture);
        return output;
      }));
    }
    process.stdout.write(`${JSON.stringify({
      port,
      readyCount,
      applied,
      reapplied,
      verified,
      screenshots,
      cleaned,
      restoreScreenshots,
    }, null, 2)}\n`);
    if (!verified.some((item) => (item as { ok?: boolean })?.ok)) process.exitCode = 1;
  } finally {
    if (injectionAttempted && cleaned.length === 0) {
      try {
        await evaluateCodexTargets(port, CLEANUP_EXPRESSION);
      } catch {
        // Best-effort cleanup: the temporary Codex process may already be gone.
      }
    }
    await fs.rm(root, { recursive: true, force: true });
  }
}

void main();
