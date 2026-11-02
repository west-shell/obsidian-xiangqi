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

/**
 * One queued analysis (lila ceval Protocol.Work): the promise endpoints,
 * the per-work parse state, and the stop disposition.
 */
interface EngineWork {
  fen: string;
  depth: number;
  onProgress?: (progress: EngineProgress) => void;
  resolve: (result: EngineResult) => void;
  reject: (reason: Error) => void;
  /** "stop" posted; settle with the partial result when bestmove arrives. */
  stopRequested: boolean;
  /** Analysis watchdog (replaces the promise-scoped timeout). */
  watchdog: number | null;
  lastScore: number | undefined;
  lastDepth: number | undefined;
  lastScoreType: "cp" | "mate" | undefined;
  expectedPvs: number;
  pvMap: Map<number, PvLine>;
}

export abstract class BaseEngine {
  protected worker: Worker | null = null;
  protected ready = false;
  private generationCounter = 0;
  protected plugin: ChessPlugin | null = null;
  protected initResolve: ((value: void) => void) | null = null;
  protected initReject: ((reason: Error) => void) | null = null;

  /**
   * lila ceval Protocol state machine: at most one search in flight
   * (`work`), one queued search (`nextWork`, latest wins), and a
   * `draining` flag that swallows the late bestmove of a
   * watchdog-aborted search so it can never settle the next one. The
   * next "position"/"go" is only posted after the previous bestmove was
   * RECEIVED, so worker-message ordering serializes searches: a stale
   * bestmove can never be attributed to a successor.
   */
  private work: EngineWork | null = null;
  private nextWork: EngineWork | null = null;
  private draining = false;
  private drainTimer: number | null = null;

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
        this.handleUciLine(trimmed);
      }
    }
  }

  analyze(
    fen: string,
    depth = 15,
    onProgress?: (progress: EngineProgress) => void,
  ): Promise<EngineResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.ready) {
        reject(new Error("Engine not ready"));
        return;
      }
      this.enqueue({
        fen,
        depth,
        onProgress,
        resolve,
        reject,
        stopRequested: false,
        watchdog: null,
        lastScore: undefined,
        lastDepth: undefined,
        lastScoreType: undefined,
        expectedPvs: 1,
        pvMap: new Map(),
      });
    });
  }

  /**
   * lila Protocol.compute(): park `next` in the single pending slot
   * (latest wins — a superseded queued work is rejected so its caller
   * never dangles), request a stop of the running search, then try to
   * swap. The successor's "position"/"go" only goes out once the
   * running search's bestmove arrived.
   */
  private enqueue(next: EngineWork): void {
    if (this.nextWork) {
      const stale = this.nextWork;
      this.nextWork = null;
      if (stale.watchdog !== null) {
        window.clearTimeout(stale.watchdog);
      }
      stale.reject(new Error("Analysis cancelled: new analysis started"));
    }
    this.nextWork = next;
    this.stopWork();
    this.swapWork();
  }

  postCommand(cmd: string): void {
    if (this.worker && this.ready) {
      this.worker.postMessage(cmd);
    }
  }

  /**
   * lila Protocol.stop()/compute(undefined): drop the queued search and
   * stop the running one. The running search still resolves with its
   * partial result when the engine answers "stop" with "bestmove".
   */
  stop(): void {
    if (this.nextWork) {
      const stale = this.nextWork;
      this.nextWork = null;
      if (stale.watchdog !== null) {
        window.clearTimeout(stale.watchdog);
      }
      stale.reject(new Error("Analysis cancelled: engine stopped"));
    }
    this.stopWork();
  }

  /** lila Protocol.stop(): idempotent — one "stop" per running search. */
  private stopWork(): void {
    if (this.work && !this.work.stopRequested) {
      this.work.stopRequested = true;
      this.worker?.postMessage("stop");
    }
  }

  /** lila Protocol.swapWork(): start the queued search only when the engine is free. */
  private swapWork(): void {
    if (!this.worker || !this.ready) return;
    if (this.work || this.draining) return;
    this.work = this.nextWork;
    this.nextWork = null;
    if (!this.work) return;
    const work = this.work;
    work.watchdog = window.setTimeout(() => {
      work.watchdog = null;
      if (this.work !== work) return;
      // Unblock the caller now; the engine's late bestmove is swallowed
      // via `draining` so it can never settle the next search.
      this.work = null;
      this.draining = true;
      this.worker?.postMessage("stop");
      this.drainTimer = window.setTimeout(() => {
        this.drainTimer = null;
        // Engine presumed dead: stop waiting for its bestmove.
        if (this.draining) {
          this.draining = false;
          this.swapWork();
        }
      }, 5000);
      work.reject(new Error("Analysis timeout"));
    }, 300_000);
    this.worker.postMessage(`position fen ${work.fen}`);
    this.worker.postMessage(`go depth ${work.depth}`);
  }

  private handleUciLine(line: string): void {
    if (line.startsWith("bestmove")) {
      if (this.draining) {
        // Bestmove of a watchdog-aborted search: swallow it, then let a
        // queued successor start.
        this.draining = false;
        if (this.drainTimer !== null) {
          window.clearTimeout(this.drainTimer);
          this.drainTimer = null;
        }
        this.swapWork();
        return;
      }
      const work = this.work;
      if (!work) return;
      this.work = null;
      if (work.watchdog !== null) {
        window.clearTimeout(work.watchdog);
        work.watchdog = null;
      }
      const parts = line.split(/\s+/);
      const bestmove = parts[1];
      const ponderIdx = parts.indexOf("ponder");
      const ponder =
        ponderIdx !== -1 && parts[ponderIdx + 1]
          ? parts[ponderIdx + 1]
          : undefined;
      if (bestmove) {
        const pvs = [...work.pvMap.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, pv]) => pv);
        work.resolve({
          bestmove,
          ponder,
          score: work.lastScore,
          depth: work.lastDepth,
          scoreType: work.lastScoreType,
          pvs: pvs.length > 0 ? pvs : undefined,
        });
      } else {
        work.reject(new Error("No move found"));
      }
      // lila Protocol: a queued successor starts right after bestmove.
      this.swapWork();
      return;
    }

    const work = this.work;
    if (!work || !line.startsWith("info")) return;
    // Skip bound-flagged lines: their scores are not exact
    const isBound = / (lowerbound|upperbound) /.test(line);
    const mpvMatch = line.match(/ multipv (\d+)/);
    const mpv = mpvMatch ? Number.parseInt(mpvMatch[1]) : 1;
    let score: number | undefined;
    let scoreType: "cp" | "mate" | undefined;
    const mateMatch = line.match(/score mate (-?\d+)/);
    if (mateMatch) {
      scoreType = "mate";
      score = Number.parseInt(mateMatch[1]);
    } else {
      const cpMatch = line.match(/score cp (-?\d+)/);
      if (cpMatch) {
        scoreType = "cp";
        score = Number.parseInt(cpMatch[1]);
      }
    }
    const pvMatch = line.match(/ pv (.+)$/);
    const depthMatch = line.match(/depth (\d+)/);
    if (!isBound && score !== undefined && scoreType && pvMatch) {
      work.pvMap.set(mpv, {
        score,
        scoreType,
        moves: pvMatch[1].trim().split(/\s+/),
      });
      // Track the widest MultiPV index seen: a depth iteration is
      // complete when its last line arrives, so every pv in a
      // streamed snapshot belongs to the same iteration.
      if (mpv > work.expectedPvs) work.expectedPvs = mpv;
    }
    if (mpv === 1 && !isBound) {
      if (score !== undefined && scoreType) {
        work.lastScore = score;
        work.lastScoreType = scoreType;
      }
      if (depthMatch) work.lastDepth = Number.parseInt(depthMatch[1]);
    }
    // Stream one snapshot per completed depth iteration (lichess
    // protocol.ts): emit once the iteration's last MultiPV line
    // arrived; the primary score is the tracked mpv-1 score, not
    // the emitting line's.
    if (
      work.onProgress &&
      mpv === work.expectedPvs &&
      !isBound &&
      work.lastScore !== undefined &&
      work.lastScoreType &&
      pvMatch
    ) {
      work.onProgress({
        score: work.lastScore,
        scoreType: work.lastScoreType,
        depth: depthMatch
          ? Number.parseInt(depthMatch[1])
          : (work.lastDepth ?? 0),
        pvs: [...work.pvMap.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, pv]) => pv),
      });
    }
  }

  terminate(): void {
    const work = this.work;
    const next = this.nextWork;
    this.work = null;
    this.nextWork = null;
    this.draining = false;
    if (this.drainTimer !== null) {
      window.clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
    if (work) {
      if (work.watchdog !== null) {
        window.clearTimeout(work.watchdog);
      }
      work.reject(new Error("Engine terminated"));
    }
    if (next) {
      if (next.watchdog !== null) {
        window.clearTimeout(next.watchdog);
      }
      next.reject(new Error("Engine terminated"));
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
    this.initResolve = null;
    this.initReject = null;
  }
}
