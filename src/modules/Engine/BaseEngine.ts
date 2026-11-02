import type { PvLine } from "../../types";

export type { PvLine };

export interface EngineResult {
  bestmove: string;
  ponder?: string;
  score?: number;
  depth?: number;
  scoreType?: "cp" | "mate";
  /** Top N candidate lines from a MultiPV search, in engine POV (side to move) */
  pvs?: PvLine[];
}

/**
 * Depth-iteration snapshot streamed while a search runs (engine POV,
 * side to move). Emitted once per completed depth iteration so the UI
 * can update live instead of waiting for the final result.
 */
export interface EngineProgress {
  score: number;
  scoreType: "cp" | "mate";
  depth: number;
  /** Candidate lines known so far; later MultiPV entries may lag one
   * iteration behind the mpv-1 line. */
  pvs: PvLine[];
}

import type ChessPlugin from "../../main";

type UciHandler = (msg: string) => void;

export abstract class BaseEngine {
  protected worker: Worker | null = null;
  protected ready = false;
  private generationCounter = 0;
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

  /** Monotonic worker lifetime counter; bumped on every "uciok". */
  get generation(): number {
    return this.generationCounter;
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
        this.generationCounter++;
        this.initResolve?.();
        this.initResolve = null;
        this.initReject = null;
      } else {
        this.msgHandler?.(trimmed);
      }
    }
  }

  analyze(
    fen: string,
    depth = 15,
    onProgress?: (progress: EngineProgress) => void,
  ): Promise<EngineResult> {
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
      let expectedPvs = 1;
      const pvMap = new Map<number, PvLine>();

      this.analyzeTimeout = window.setTimeout(() => {
        this.analyzeTimeout = null;
        this.msgHandler = null;
        this.analyzeReject = null;
        this.stop();
        reject(new Error("Analysis timeout"));
      }, 300_000);

      this.msgHandler = (msg: string) => {
        if (msg.startsWith("info")) {
          // Skip bound-flagged lines: their scores are not exact
          const isBound = / (lowerbound|upperbound) /.test(msg);
          const mpvMatch = msg.match(/ multipv (\d+)/);
          const mpv = mpvMatch ? Number.parseInt(mpvMatch[1]) : 1;
          let score: number | undefined;
          let scoreType: "cp" | "mate" | undefined;
          const mateMatch = msg.match(/score mate (-?\d+)/);
          if (mateMatch) {
            scoreType = "mate";
            score = Number.parseInt(mateMatch[1]);
          } else {
            const cpMatch = msg.match(/score cp (-?\d+)/);
            if (cpMatch) {
              scoreType = "cp";
              score = Number.parseInt(cpMatch[1]);
            }
          }
          const pvMatch = msg.match(/ pv (.+)$/);
          const depthMatch = msg.match(/depth (\d+)/);
          if (!isBound && score !== undefined && scoreType && pvMatch) {
            pvMap.set(mpv, {
              score,
              scoreType,
              moves: pvMatch[1].trim().split(/\s+/),
            });
            // Track the widest MultiPV index seen: a depth iteration is
            // complete when its last line arrives, so every pv in a
            // streamed snapshot belongs to the same iteration.
            if (mpv > expectedPvs) expectedPvs = mpv;
          }
          if (mpv === 1 && !isBound) {
            if (score !== undefined && scoreType) {
              lastScore = score;
              lastScoreType = scoreType;
            }
            if (depthMatch) lastDepth = Number.parseInt(depthMatch[1]);
          }
          // Stream one snapshot per completed depth iteration (lichess
          // protocol.ts): emit once the iteration's last MultiPV line
          // arrived; the primary score is the tracked mpv-1 score, not
          // the emitting line's.
          if (
            onProgress &&
            mpv === expectedPvs &&
            !isBound &&
            lastScore !== undefined &&
            lastScoreType &&
            pvMatch
          ) {
            onProgress({
              score: lastScore,
              scoreType: lastScoreType,
              depth: depthMatch
                ? Number.parseInt(depthMatch[1])
                : (lastDepth ?? 0),
              pvs: [...pvMap.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([, pv]) => pv),
            });
          }
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
            const pvs = [...pvMap.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([, pv]) => pv);
            resolve({
              bestmove,
              ponder,
              score: lastScore,
              depth: lastDepth,
              scoreType: lastScoreType,
              pvs: pvs.length > 0 ? pvs : undefined,
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
