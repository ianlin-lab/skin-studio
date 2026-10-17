import type { UpdateStatus } from "../../shared/types";

const LATEST_RELEASE_API = "https://api.github.com/repos/ianlin-lab/skin-studio/releases/latest";
export const RELEASES_URL = "https://github.com/ianlin-lab/skin-studio/releases/latest";

function versionParts(value: string): number[] | null {
  const match = value.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = versionParts(candidate);
  const installed = versionParts(current);
  if (!next || !installed) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== installed[index]) return next[index] > installed[index];
  }
  return false;
}

export async function checkForUpdate(
  currentVersion: string,
  fetcher: typeof fetch = fetch,
): Promise<UpdateStatus> {
  const base: UpdateStatus = {
    currentVersion,
    latestVersion: null,
    available: false,
    checkedAt: new Date().toISOString(),
  };
  try {
    const response = await fetcher(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Skin-Studio" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    const release = await response.json() as { tag_name?: unknown; draft?: unknown; prerelease?: unknown };
    if (release.draft || release.prerelease || typeof release.tag_name !== "string"
      || !versionParts(release.tag_name)) throw new Error("版本信息无效");
    return {
      ...base,
      latestVersion: release.tag_name.replace(/^v/, ""),
      available: isNewerVersion(release.tag_name, currentVersion),
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}
