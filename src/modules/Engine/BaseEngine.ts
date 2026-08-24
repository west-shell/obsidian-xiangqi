export interface EngineResult {
  bestmove: string;
  ponder?: string;
  score?: number;
  depth?: number;
  scoreType?: "cp" | "mate";
}

import type ChessPlugin from "../../main";

type UciHandler = (msg: string) => void;

export abstract class BaseEngine {
  protected worker: Worker | null = null;
  protected ready = false;
  protected plugin: ChessPlugin | null = null;
  protected msgHandler: UciHandler | null = null;
  protected initResolve: ((value: void) => void) | null = null;
  protected initReject: ((reason: Error) => void) | null = null;
  protected analyzeReject: ((reason: Error) => void) | null = null;
  protected analyzeTimeout: number | null = null;

  setPlugin(plugin: ChessPlugin): void {
    this.plugin = plugin;
  }

  isReady(): boolean {
    return this.worker !== null && this.ready;
  }

  async ensureReady(): Promise<void> {
    if (this.worker && this.ready) return;
    this.terminate();
    await this.initWorker();
  }

  abstract checkFileExists(): Promise<string[]>;
  abstract openDownloadModal(missingFiles: string[]): void;
  protected abstract initWorker(): Promise<void>;

  protected handleMessage(raw: unknown): void {
    if (
      raw &&
      typeof raw === "object" &&
      (raw as Record<string, unknown>).type
    ) {
      const obj = raw as Record<string, string>;
      if (obj.type === "error") {
        console.warn("[Engine] worker error:", obj.data);
        this.initReject?.(new Error(obj.data));
        this.initResolve = null;
        this.initReject = null;
      }
      return;
    }

    if (typeof raw !== "string") return;
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "uciok") {
        this.ready = true;
        this.initResolve?.();
        this.initResolve = null;
        this.initReject = null;
      } else {
        this.msgHandler?.(trimmed);
      }
    }
  }

  analyze(fen: string, depth = 15): Promise<EngineResult> {
    if (this.analyzeReject) {
      this.analyzeReject(new Error("Analysis cancelled: new analysis started"));
    }
    if (this.analyzeTimeout !== null) {
      window.clearTimeout(this.analyzeTimeout);
    }

    return new Promise((resolve, reject) => {
      if (!this.worker || !this.ready) {
        reject(new Error("Engine not ready"));
        return;
      }

      this.analyzeReject = reject;

      let lastScore: number | undefined;
      let lastDepth: number | undefined;
      let lastScoreType: "cp" | "mate" | undefined;

      this.analyzeTimeout = window.setTimeout(() => {
        this.analyzeTimeout = null;
        this.msgHandler = null;
        this.analyzeReject = null;
        this.stop();
        reject(new Error("Analysis timeout"));
      }, 300_000);

      this.msgHandler = (msg: string) => {
        if (msg.startsWith("info")) {
          const mateMatch = msg.match(/score mate (-?\d+)/);
          if (mateMatch) {
            lastScoreType = "mate";
            lastScore = Number.parseInt(mateMatch[1]);
          } else {
            const cpMatch = msg.match(/score cp (-?\d+)/);
            if (cpMatch) {
              lastScoreType = "cp";
              lastScore = Number.parseInt(cpMatch[1]);
            }
          }
          const depthMatch = msg.match(/depth (\d+)/);
          if (depthMatch) lastDepth = Number.parseInt(depthMatch[1]);
        } else if (msg.startsWith("bestmove")) {
          const parts = msg.split(/\s+/);
          const bestmove = parts[1];
          const ponderIdx = parts.indexOf("ponder");
          const ponder =
            ponderIdx !== -1 && parts[ponderIdx + 1]
              ? parts[ponderIdx + 1]
              : undefined;
          this.msgHandler = null;
          this.analyzeReject = null;
          if (this.analyzeTimeout !== null) {
            window.clearTimeout(this.analyzeTimeout);
            this.analyzeTimeout = null;
          }
          if (bestmove) {
            resolve({
              bestmove,
              ponder,
              score: lastScore,
              depth: lastDepth,
              scoreType: lastScoreType,
            });
          } else {
            reject(new Error("No move found"));
          }
        }
      };

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  postCommand(cmd: string): void {
    if (this.worker && this.ready) {
      this.worker.postMessage(cmd);
    }
  }

  stop(): void {
    if (this.worker && this.ready) {
      this.worker.postMessage("stop");
    }
  }

  terminate(): void {
    if (this.analyzeReject) {
      this.analyzeReject(new Error("Engine terminated"));
      this.analyzeReject = null;
    }
    if (this.analyzeTimeout !== null) {
      window.clearTimeout(this.analyzeTimeout);
      this.analyzeTimeout = null;
    }
    if (this.worker) {
      try {
        this.worker.postMessage("quit");
      } catch {
        /* ignore */
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.msgHandler = null;
    this.initResolve = null;
    this.initReject = null;
  }
}
