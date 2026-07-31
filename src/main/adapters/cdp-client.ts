import WebSocket from "ws";

interface CdpTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

interface CdpMessage {
  id?: number;
  result?: {
    result?: {
      type?: string;
      value?: unknown;
      description?: string;
    };
    exceptionDetails?: {
      text?: string;
      exception?: { description?: string };
    };
  };
  error?: {
    message?: string;
  };
}

class CdpSession {
  private readonly socket: WebSocket;
  private sequence = 0;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: NodeJS.Timeout;
  }>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on("message", (raw) => {
      let message: CdpMessage;
      try {
        message = JSON.parse(raw.toString()) as CdpMessage;
      } catch {
        return;
      }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "CDP command failed"));
      else pending.resolve(message.result);
    });
    const close = () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("CDP connection closed"));
      }
      this.pending.clear();
    };
    socket.on("close", close);
    socket.on("error", close);
  }

  static async connect(urlValue: string): Promise<CdpSession> {
    const url = new URL(urlValue);
    if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
      throw new Error("拒绝连接非本机 CDP 地址");
    }
    const socket = new WebSocket(url, {
      handshakeTimeout: 3_000,
      maxPayload: 32 * 1024 * 1024,
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP WebSocket 连接超时")), 4_000);
      socket.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    return new CdpSession(socket);
  }

  async evaluate(expression: string): Promise<unknown> {
    const response = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: false,
    }) as CdpMessage["result"];
    if (response?.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description
        || response.exceptionDetails.text
        || "CDP evaluate failed",
      );
    }
    return response?.result?.value;
  }

  async captureScreenshot(): Promise<Buffer> {
    await this.send("Page.enable", {});
    const response = await this.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    }) as { data?: string };
    if (!response.data) throw new Error("CDP 截图响应无效");
    return Buffer.from(response.data, "base64");
  }

  close(): void {
    this.socket.close();
  }

  private async send(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.sequence;
    const response = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} 超时`));
      }, 6_000);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return response;
  }
}

const CODEX_PROBE = `(() => {
  const markers = [
    document.querySelector("main.main-surface"),
    document.querySelector("aside.app-shell-left-panel"),
    document.querySelector('[data-testid="home-icon"]'),
    document.querySelector(".composer-surface-chrome")
  ].filter(Boolean).length;
  const root = document.documentElement;
  const electronShell = root?.classList.contains("electron-dark")
    || root?.classList.contains("electron-light")
    || root?.classList.contains("electron-opaque");
  return {
    codex: ["file:", "app:"].includes(location.protocol)
      && (markers > 0 || (electronShell && /chatgpt|codex/i.test(document.title))),
    markers,
    title: document.title,
    readyState: document.readyState
  };
})()`;

export async function listCdpTargets(port: number): Promise<CdpTarget[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(1_500),
  });
  if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
  const value = await response.json() as CdpTarget[];
  if (!Array.isArray(value)) throw new Error("CDP targets 响应无效");
  return value.filter((target) => {
    if (target.type !== "page" || !target.webSocketDebuggerUrl) return false;
    if (target.url.startsWith("devtools://") || target.url.startsWith("chrome-extension://")) return false;
    if (/initialRoute=.*(?:avatar-overlay|pip|helper)/i.test(target.url)) return false;
    try {
      const wsUrl = new URL(target.webSocketDebuggerUrl);
      return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(wsUrl.hostname);
    } catch {
      return false;
    }
  });
}

async function withCodexSessions<T>(
  port: number,
  operation: (session: CdpSession) => Promise<T>,
): Promise<T[]> {
  const targets = await listCdpTargets(port);
  const results: T[] = [];
  for (const target of targets) {
    let session: CdpSession | undefined;
    try {
      session = await CdpSession.connect(target.webSocketDebuggerUrl);
      const probe = await session.evaluate(CODEX_PROBE) as { codex?: boolean };
      if (!probe?.codex) continue;
      results.push(await operation(session));
    } finally {
      session?.close();
    }
  }
  return results;
}

export async function waitForCodexCdp(port: number, timeoutMs = 18_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const matches = await withCodexSessions(port, async () => true);
      if (matches.length) return matches.length;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`没有在 127.0.0.1:${port} 找到 Codex 渲染器：${
    lastError instanceof Error ? lastError.message : "等待超时"
  }`);
}

export async function evaluateCodexTargets(port: number, expression: string): Promise<unknown[]> {
  return withCodexSessions(port, (session) => session.evaluate(expression));
}

export async function captureCodexTargets(port: number): Promise<Buffer[]> {
  return withCodexSessions(port, (session) => session.captureScreenshot());
}

export async function isCodexCdp(port: number): Promise<boolean> {
  try {
    return (await withCodexSessions(port, async () => true)).length > 0;
  } catch {
    return false;
  }
}
