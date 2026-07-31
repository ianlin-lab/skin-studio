const PARTS = new Set([
  "root",
  "sidebar",
  "main",
  "header",
  "home",
  "home-hero",
  "project-list",
  "thread",
  "message",
  "composer",
  "composer-toolbar",
  "dialog",
]);

const PROPERTIES = new Set([
  "backdrop-filter",
  "background-color",
  "border-bottom-color",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-bottom-style",
  "border-bottom-width",
  "border-color",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-radius",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-style",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-top-style",
  "border-top-width",
  "border-width",
  "box-shadow",
  "color",
  "column-gap",
  "font-family",
  "font-size",
  "font-weight",
  "gap",
  "letter-spacing",
  "line-height",
  "opacity",
  "row-gap",
  "transition-duration",
  "transition-property",
]);

const VARIABLES = new Set([
  "--ds-theme-color-background",
  "--ds-theme-color-panel",
  "--ds-theme-color-panel-alt",
  "--ds-theme-color-accent",
  "--ds-theme-color-accent-alt",
  "--ds-theme-color-secondary",
  "--ds-theme-color-highlight",
  "--ds-theme-color-text",
  "--ds-theme-color-muted",
  "--ds-theme-color-line",
  "--ds-theme-font-family",
  "--ds-theme-font-scale",
  "--ds-theme-surface-opacity",
  "--ds-theme-surface-blur",
  "--ds-theme-surface-radius",
  "--ds-theme-surface-border-alpha",
  "--ds-theme-surface-shadow",
  "--ds-theme-image-focus-x",
  "--ds-theme-image-focus-y",
  "--ds-theme-image-zoom",
  "--ds-theme-image-dim",
  "--ds-theme-image-task-intensity",
  "--ds-theme-density-scale",
  "--ds-theme-motion-level",
]);

const SELECTOR = /^\[data-ds-part="([a-z-]+)"\](?::(hover|focus-visible))?$/;
const SAFE_VALUE = /^[#(),.%+\-/*\w\s"']+$/;

export interface SafeCssResult {
  contract: "dreamskin-safe-css/1";
  css: string;
  ruleCount: number;
  declarationCount: number;
}

/**
 * Parses the public Dream Skin Safe CSS surface and emits a canonical subset.
 * It deliberately accepts less than a browser CSS parser: no descendants,
 * at-rules, URLs, escapes, comments, arbitrary variables, or layout primitives.
 */
export function validateSafeCss(source: string): SafeCssResult {
  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes < 1 || bytes > 262_144) throw new Error("theme.css 大小不在安全范围内");
  if (
    source.includes("/*")
    || source.includes("*/")
    || source.includes("@")
    || source.includes("\\")
    || /url\s*\(|expression\s*\(|!important/i.test(source)
  ) {
    throw new Error("theme.css 包含不受支持的语法");
  }

  const rules: string[] = [];
  let declarationCount = 0;
  let cursor = 0;
  const matcher = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(source))) {
    if (source.slice(cursor, match.index).trim()) throw new Error("theme.css 规则结构无效");
    cursor = matcher.lastIndex;
    const selector = match[1].trim();
    const selectorMatch = selector.match(SELECTOR);
    if (!selectorMatch || !PARTS.has(selectorMatch[1])) {
      throw new Error(`theme.css 选择器不受支持：${selector}`);
    }
    const declarations: string[] = [];
    for (const rawDeclaration of match[2].split(";")) {
      const declaration = rawDeclaration.trim();
      if (!declaration) continue;
      const colon = declaration.indexOf(":");
      if (colon < 1) throw new Error("theme.css 声明无效");
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (!(PROPERTIES.has(property) || VARIABLES.has(property))) {
        throw new Error(`theme.css 属性不受支持：${property}`);
      }
      if (!value || value.length > 512 || !SAFE_VALUE.test(value)) {
        throw new Error(`theme.css 属性值不受支持：${property}`);
      }
      for (const variable of value.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)) {
        if (!VARIABLES.has(variable[1])) throw new Error(`theme.css 变量不受支持：${variable[1]}`);
      }
      if (/var\(/i.test(value) && !/var\(\s*--[a-z0-9-]+\s*\)/i.test(value)) {
        throw new Error(`theme.css 变量表达式无效：${property}`);
      }
      if (property === "opacity" && Number(value) < 0.08) {
        throw new Error("theme.css 不允许把部件完全隐藏");
      }
      declarations.push(`  ${property}: ${value};`);
      declarationCount += 1;
      if (declarationCount > 512) throw new Error("theme.css 声明数量超过限制");
    }
    if (!declarations.length) throw new Error("theme.css 包含空规则");
    rules.push(`${selector} {\n${declarations.join("\n")}\n}`);
    if (rules.length > 128) throw new Error("theme.css 规则数量超过限制");
  }
  if (source.slice(cursor).trim() || !rules.length) throw new Error("theme.css 没有有效规则");
  return {
    contract: "dreamskin-safe-css/1",
    css: `${rules.join("\n")}\n`,
    ruleCount: rules.length,
    declarationCount,
  };
}
