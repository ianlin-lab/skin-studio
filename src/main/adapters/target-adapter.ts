import type { CodexStatus, OperationResult, ThemeManifest } from "../../shared/types";

export class RestartRequiredError extends Error {
  constructor(message = "需要重启 Codex 才能建立本机主题会话") {
    super(message);
    this.name = "RestartRequiredError";
  }
}

export interface TargetAdapter {
  readonly id: string;
  detect(): Promise<CodexStatus>;
  apply(theme: ThemeManifest, assetPath: string, allowRestart?: boolean): Promise<OperationResult>;
  reapply(theme: ThemeManifest, assetPath: string): Promise<OperationResult>;
  restore(): Promise<OperationResult>;
  dispose(): void;
}
