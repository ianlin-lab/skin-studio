import { describe, expect, it } from "vitest";
import { validateSafeCss } from "../src/main/core/safe-css";

describe("Dream Skin Safe CSS", () => {
  it("accepts the public part and token contract", () => {
    const result = validateSafeCss(`
      [data-ds-part="sidebar"] {
        background-color: var(--ds-theme-color-panel);
        border-color: rgba(114, 224, 189, .24);
        backdrop-filter: blur(12px);
      }
      [data-ds-part="composer"]:focus-visible {
        border-color: var(--ds-theme-color-accent);
      }
    `);
    expect(result.contract).toBe("dreamskin-safe-css/1");
    expect(result.ruleCount).toBe(2);
    expect(result.declarationCount).toBe(4);
  });

  it.each([
    "body { display: none; }",
    '[data-ds-part="main"] * { color: #ffffff; }',
    '[data-ds-part="main"] { background-image: url(https://example.com/a.png); }',
    '[data-ds-part="main"] { position: fixed; }',
    '@import "https://example.com/theme.css";',
  ])("rejects unsafe CSS: %s", (source) => {
    expect(() => validateSafeCss(source)).toThrow();
  });
});
