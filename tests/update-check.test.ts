import { describe, expect, it, vi } from "vitest";
import { checkForUpdate, isNewerVersion, RELEASES_URL } from "../src/main/core/update-check";

describe("release update check", () => {
  it("compares stable versions and ignores malformed tags", () => {
    expect(isNewerVersion("v0.1.4", "0.1.3")).toBe(true);
    expect(isNewerVersion("v0.1.3", "0.1.3")).toBe(false);
    expect(isNewerVersion("v0.1.2", "0.1.3")).toBe(false);
    expect(isNewerVersion("untrusted", "0.1.3")).toBe(false);
  });

  it("reports a newer GitHub release without trusting a remote download URL", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      tag_name: "v0.1.4",
      html_url: "https://example.invalid/unsafe",
    }), { status: 200 })) as unknown as typeof fetch;
    const result = await checkForUpdate("0.1.3", fetcher);
    expect(result).toMatchObject({ currentVersion: "0.1.3", latestVersion: "0.1.4", available: true });
    expect(RELEASES_URL).toBe("https://github.com/ianlin-lab/skin-studio/releases/latest");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.github.com/repos/ianlin-lab/skin-studio/releases/latest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("fails closed while offline or receiving an invalid release", async () => {
    const offline = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(checkForUpdate("0.1.3", offline))
      .resolves.toMatchObject({ available: false, latestVersion: null, error: "offline" });
    const malformed = vi.fn(async () => new Response(JSON.stringify({ tag_name: "next" }), {
      status: 200,
    })) as unknown as typeof fetch;
    await expect(checkForUpdate("0.1.3", malformed))
      .resolves.toMatchObject({ available: false, latestVersion: null, error: "版本信息无效" });
  });
});
