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
  const fixtureModal = process.argv.includes("--fixture-modal");
  const themeDirIndex = process.argv.indexOf("--theme-dir");
  const themeDir = themeDirIndex >= 0 ? path.resolve(process.argv[themeDirIndex + 1] || "") : undefined;
  if (!Number.isInteger(port) || port < 1024) {
    throw new Error(
      "Usage: npm run verify:cdp -- --port <loopback-cdp-port> [--builtin | --theme-dir <local-theme-folder>] [--fixture-modal] [--screenshot <png-path>]",
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
  let assetPath = asset;
  let assetContents = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1200"><defs><linearGradient id="g"><stop stop-color="#071a17"/><stop offset="1" stop-color="#343067"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  if (useBuiltin) {
    if (!builtinTheme) throw new Error("当前没有可用于验证的内置主题");
    if (!builtinTheme.svg) throw new Error("当前验证主题没有内联 SVG 素材");
    theme = structuredClone(builtinTheme.manifest);
    assetContents = builtinTheme.svg;
  }
  if (themeDir) {
    theme = JSON.parse(await fs.readFile(path.join(themeDir, "theme.json"), "utf8")) as ThemeManifest;
    if (theme.format !== "skin-studio-theme-v1" || !theme.asset?.file
      || path.basename(theme.asset.file) !== theme.asset.file) {
      throw new Error("测试主题目录中的 theme.json 无效");
    }
    assetPath = path.join(themeDir, theme.asset.file);
  }
  let injectionAttempted = false;
  let cleaned: unknown[] = [];
  try {
    if (!themeDir) await fs.writeFile(asset, assetContents);
    const payload = await buildInjectionPayload(theme, assetPath);
    injectionAttempted = true;
    const readyCount = await injectThemeWhenReady(port, theme.id, payload, 24_000);
    const applied = await evaluateCodexTargets(
      port,
      verifyExpression(theme.id, payload.revision),
    );
    const reapplied = await evaluateCodexTargets(port, payload.expression);
    const verified = await evaluateCodexTargets(port, verifyExpression(theme.id, payload.revision));
    if (fixtureModal) {
      await evaluateCodexTargets(port, `(() => {
        document.getElementById('skin-studio-test-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'skin-studio-test-modal';
        modal.setAttribute('role', 'alertdialog');
        modal.style.cssText = 'position:fixed;z-index:2147483647;top:20%;left:30%;padding:24px;width:400px;background:rgba(52,30,22,.3)';
        const description = document.createElement('div');
        description.className = 'text-secondary';
        description.textContent = '测试弹窗的正文对比度';
        modal.appendChild(description);
        for (const [label, background] of [['取消', '#ffffff'], ['删除', '#bf2626']]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.style.cssText = 'padding:10px 24px;margin:12px 8px 0 0;border-radius:10px;background-color:' + background + ';color:' + background;
          modal.appendChild(button);
        }
        document.body.appendChild(modal);
        return true;
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    const visualExpression = `(() => {
      const candidates = [...document.querySelectorAll('[data-composer-surface-variant]:not([data-composer-surface-variant="inline"])')];
      const composer = candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 30 && rect.height > 30;
      });
      const editor = composer?.querySelector('[contenteditable="true"], textarea');
      const style = composer ? getComputedStyle(composer) : null;
      return {
        composerCandidates: candidates.length,
        composerVisible: Boolean(composer && composer.getBoundingClientRect().top < innerHeight && composer.getBoundingClientRect().bottom > 0),
        composerRects: candidates.map((node) => {
          const rect = node.getBoundingClientRect();
          const computed = getComputedStyle(node);
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height), display: computed.display, visibility: computed.visibility, opacity: computed.opacity };
        }),
        viewportHeight: innerHeight,
        composerSurface: style ? { color: style.color, background: style.backgroundColor, border: style.borderColor } : null,
        editorColor: editor ? getComputedStyle(editor).color : null,
        modalCount: document.querySelectorAll('[role="alertdialog"], [role="dialog"][aria-modal="true"]').length
      };
    })()`;
    const visualStatus = await evaluateCodexTargets(port, visualExpression);
    const fixtureStatus = fixtureModal ? await evaluateCodexTargets(port, `(() => {
      const modal = document.getElementById('skin-studio-test-modal');
      if (!modal) return null;
      const style = getComputedStyle(modal);
      return {
        modalBackground: style.backgroundColor,
        descriptionColor: getComputedStyle(modal.querySelector('.text-secondary')).color,
        buttons: [...modal.querySelectorAll('button')].map((button) => ({
          contrast: button.getAttribute('data-skin-studio-contrast'),
          foreground: getComputedStyle(button).color,
          background: getComputedStyle(button).backgroundColor
        }))
      };
    })()`) : [];
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
    const restoredVisualStatus = await evaluateCodexTargets(port, visualExpression);
    if (fixtureModal) {
      await evaluateCodexTargets(port, "document.getElementById('skin-studio-test-modal')?.remove(); true");
    }
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
      visualStatus,
      restoredVisualStatus,
      fixtureStatus,
      screenshots,
      cleaned,
      restoreScreenshots,
    }, null, 2)}\n`);
    if (!verified.some((item) => (item as { ok?: boolean })?.ok)
      || visualStatus.some((item) => {
        const status = item as { composerCandidates?: number; composerVisible?: boolean };
        return Boolean(status.composerCandidates && !status.composerVisible);
      })) process.exitCode = 1;
  } finally {
    if (injectionAttempted && cleaned.length === 0) {
      try {
        await evaluateCodexTargets(port, CLEANUP_EXPRESSION);
      } catch {
        // Best-effort cleanup: the temporary Codex process may already be gone.
      }
    }
    if (fixtureModal) {
      try {
        await evaluateCodexTargets(port, "document.getElementById('skin-studio-test-modal')?.remove(); true");
      } catch {
        // The isolated test process may already be gone.
      }
    }
    await fs.rm(root, { recursive: true, force: true });
  }
}

void main();
