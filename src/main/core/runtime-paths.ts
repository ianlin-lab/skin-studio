import path from "node:path";

export function resolveBundledThemesDirectory(
  appPath: string,
  isPackaged: boolean,
  workingDirectory = process.cwd(),
): string {
  return path.join(isPackaged ? appPath : workingDirectory, "bundled-themes");
}
