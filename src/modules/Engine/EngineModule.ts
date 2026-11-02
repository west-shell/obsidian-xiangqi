import type {
  ChessNode,
  GhostLines,
  IHost,
  NodeEval,
  PvLine,
} from "../../types";
import type { Move } from "../../chess";
import { Chess, getAutoResult, moveToUci } from "../../chess";
import { engine, type EngineResult } from "./Engine";
import type { EngineProgress } from "./BaseEngine";
import { buildGhostLines, GHOST_MAX_PLIES } from "./ghost-lines";
import { fillChildrenFromEval } from "./pv-cache";
import { computeGlyph } from "../../utils/winningChances";

/**
 * Lower bound for the MultiPV option. The pv-cache attribution uses all
 * returned ranks to give existing children an eval, so even a ghost-line
 * setting below this keeps the search breadth for child attribution.
 */
const MULTI_PV_MIN = 3;

/**
 * Trailing-edge throttle (lichess ceval's throttleWithFlush pattern):
 * the first call runs immediately; calls within `interval` are queued
 * and the latest one runs once the interval elapses — intermediate
 * updates are delayed, never dropped. `cancel` discards a pending
 * queued call, e.g. when the search finished with a final result.
 */
function throttleProgress(
  interval: number,
  fn: (progress: EngineProgress) => void,
): { throttled: (progress: EngineProgress) => void; cancel: () => void } {
  let timerId: number | null = null;
  let queued: EngineProgress | null = null;
  const runNext = (): void => {
    timerId = null;
    if (!queued) return;
    const progress = queued;
    queued = null;
    fn(progress);
    timerId = window.setTimeout(runNext, interval);
  };
  return {
    throttled: (progress: EngineProgress) => {
      if (timerId !== null) {
        queued = progress;
        return;
      }
      fn(progress);
      timerId = window.setTimeout(runNext, interval);
    },
    cancel: () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      queued = null;
    },
  };
}

function initEngine(host: object) {
  const h = host as IHost;
  engine.setPlugin(h.plugin);
  const { eventBus, settings } = h;

  let analyzing = false;
  let batchCancelled = false;
  let autoAnalyze = false;
  let batchAnalyzing = false;
  let needRebuildBatch = false;
  let batchQueue: string[] = [];
  let pendingNodeId: string | null = null;
  let stopped = false;
  let simWhite = false;
  let simBlack = false;
  let simTimer: number | null = null;
  let simSearching = false;
  const simFenCounts = new Map<string, number>();
  let lastNodeId: string | null = null;
  let lastGen = h.generation;
  let lastResult: {
    bestmove: string;
    ponder?: string;
    score?: number;
    depth?: number;
    scoreType?: "cp" | "mate";
  } | null = null;

  let appliedOptionsGen = -1;
  let appliedSkill = -1;
  let appliedMultiPv = -1;
  let appliedFixedOptions = false;

  function applyOptions() {
    // Posting while not ready would silently drop the commands but still
    // mark them applied — skip and retry on the next call.
    if (!engine.isReady()) return;
    // Options reset to defaults whenever the worker restarts (new
    // generation): re-apply everything once.
    if (engine.generation !== appliedOptionsGen) {
      appliedOptionsGen = engine.generation;
      appliedSkill = -1;
      appliedMultiPv = -1;
      appliedFixedOptions = false;
    }
    if (appliedSkill !== settings.engineSkillLevel) {
      engine.postCommand(
        `setoption name Skill Level value ${settings.engineSkillLevel}`,
      );
      appliedSkill = settings.engineSkillLevel;
    }
    if (!appliedFixedOptions) {
      engine.postCommand(`setoption name Ponder value false`);
      // A larger transposition table keeps prior searches reusable when
      // positions are revisited or re-searched deeper. Posted once per
      // worker lifetime: re-posting "Hash" with an unchanged value can
      // reallocate and clear the TT in some Stockfish builds, which
      // would break cross-search cache reuse.
      engine.postCommand(`setoption name Hash value 64`);
      appliedFixedOptions = true;
    }
    // MultiPV follows the ghost-line setting: the engine searches (and
    // the tree renders) the requested number of candidate lines, with a
    // floor of MULTI_PV_MIN for pv-cache child attribution. Unlike
    // "Hash", re-sending MultiPV is safe — it never clears the TT.
    const multiPv = Math.max(MULTI_PV_MIN, settings.engineGhostLines);
    if (appliedMultiPv !== multiPv) {
      engine.postCommand(`setoption name MultiPV value ${multiPv}`);
      appliedMultiPv = multiPv;
    }
  }

  function toWhiteView(
    score: number,
    scoreType: string | undefined,
    fen: string,
  ): number {
    let s = score;
    if (fen.split(" ")[1] === "b") {
      s = -s;
    }
    if (scoreType === "mate" && s === 0) {
      s = fen.split(" ")[1] === "w" ? -1 : 1;
    }
    return s;
  }

  function toWhiteViewPvs(
    pvs: PvLine[] | undefined,
    fen: string,
  ): PvLine[] | undefined {
    if (!pvs) return undefined;
    return pvs.map((pv) => ({
      score: toWhiteView(pv.score, pv.scoreType, fen),
      scoreType: pv.scoreType,
      moves: pv.moves,
    }));
  }

  /**
   * Attribute an eval to the move leading to `node`:
   * prefer the PV line from the SAME search of the parent position
   * (exact, no search jitter), otherwise fall back to the child node's
   * own eval from a separate search (subject to the noise band).
   */
  function playedMoveEval(
    parentEval: NodeEval | undefined,
    node: ChessNode,
  ): { ev: NodeEval; sameSearch: boolean } | null {
    const uci = node.move ? moveToUci(node.move) : "";
    if (parentEval?.pvs && uci) {
      const pv = parentEval.pvs.find((p) => p.moves[0] === uci);
      if (pv) {
        return {
          ev: {
            score: pv.score,
            scoreType: pv.scoreType,
            depth: parentEval.depth,
          },
          sameSearch: true,
        };
      }
    }
    if (node.eval) {
      return { ev: node.eval, sameSearch: false };
    }
    return null;
  }

  function setNodeGlyph(node: ChessNode) {
    // Auto-annotate off: the engine neither writes nor clears glyphs.
    // Imported or manually added annotations are never touched.
    if (!settings.showEngineAnnotations) return;
    const parent = node.parentID ? h.nodeMap.get(node.parentID) : undefined;
    const self = playedMoveEval(parent?.eval, node);
    node.glyph = self
      ? computeGlyph(parent?.eval, self.ev, node.color, self.sameSearch)
      : null;
    for (const child of node.children) {
      const played = playedMoveEval(node.eval, child);
      child.glyph = played
        ? computeGlyph(node.eval, played.ev, child.color, played.sameSearch)
        : null;
    }
  }

  /**
   * Stores a finished search on `node`: white-view score, glyph, and
   * attribution to existing children so stepping into them hits the
   * analysis cache instead of re-searching.
   */
  function applyResultToNode(node: ChessNode, result: EngineResult): NodeEval {
    const score = toWhiteView(result.score ?? 0, result.scoreType, node.fen);
    const nodeEval: NodeEval = {
      score,
      scoreType: result.scoreType ?? "cp",
      depth: result.depth ?? 0,
      bestmove: result.bestmove !== "(none)" ? result.bestmove : undefined,
      ponder: result.ponder,
      pvs: toWhiteViewPvs(result.pvs, node.fen),
    };
    node.eval = nodeEval;
    setNodeGlyph(node);
    fillChildrenFromEval(node);
    return nodeEval;
  }

  /**
   * Live depth-iteration update while a search runs (lichess-style):
   * writes the intermediate eval in white view so the best-move arrow,
   * eval displays and ghost lines refresh per depth instead of only on
   * completion. Glyphs and child attribution stay untouched here —
   * they are computed once from the final result.
   */
  function applySearchProgress(node: ChessNode, progress: EngineProgress) {
    const score = toWhiteView(progress.score, progress.scoreType, node.fen);
    const pvs = toWhiteViewPvs(progress.pvs, node.fen) ?? [];
    node.eval = {
      score,
      scoreType: progress.scoreType,
      depth: progress.depth,
      bestmove: pvs[0]?.moves[0],
      ponder: pvs[0]?.moves[1],
      pvs,
    };
    const best = pvs[0]?.moves[0];
    if (best) {
      eventBus.emit("engine-result", {
        bestmove: best,
        ponder: pvs[0]?.moves[1],
        score,
        depth: progress.depth,
        scoreType: progress.scoreType,
      });
      // The progress result flips the toolbar's busy flag off; restore
      // it so the spinner keeps running until the search completes.
      eventBus.emit("engine-busy");
    }
    emitGhosts();
    eventBus.emit("updateUI");
  }

  function dispatchMode(mode: string) {
    if (mode === "once") {
      eventBus.emit("engine-analyze");
    } else if (mode === "auto") {
      eventBus.emit("engine-auto-toggle");
    } else if (mode === "batch") {
      eventBus.emit("engine-analyze-batch");
    }
  }

  // ---- Engine PV ghost lines on the tree graph ----
  // Live-only preview (xiangqiai discardLiveInfo pattern): the lines of
  // the CURRENT node's last engine search render as ghost chains; they
  // are discarded on position change, engine stop and game switch.
  let ghostLines: GhostLines | null = null;

  function emitGhosts() {
    const node = h.currentNode;
    if (!settings.showEngineGhosts || !node || !node.eval?.pvs) {
      clearGhosts();
      return;
    }
    ghostLines = buildGhostLines(
      node,
      GHOST_MAX_PLIES,
      settings.engineGhostLines,
    );
    eventBus.emit("tree-ghost-lines", ghostLines);
  }

  function clearGhosts() {
    if (!ghostLines) return;
    ghostLines = null;
    eventBus.emit("tree-ghost-lines", null);
  }

  // Clicking a ghost materializes the line: navigate to the attachment
  // node, then replay the chain move by move — existing moves merge
  // (runmove matches children), missing ones are created as a variation.
  eventBus.on<string>("tree-ghost-materialize", (ghostId) => {
    if (!ghostId || !ghostLines) return;
    for (const line of ghostLines.lines) {
      if (!line.head) continue;
      const moves: Move[] = [];
      let g: ChessNode | null = line.head;
      let found = false;
      while (g) {
        if (!g.move) break;
        moves.push(g.move);
        if (g.id === ghostId) {
          found = true;
          break;
        }
        g = g.children[0] ?? null;
      }
      if (!found) continue;
      const attach = h.nodeMap.get(line.attachId);
      if (!attach) return;
      eventBus.emit("node-click", attach.id);
      for (const mv of moves) {
        eventBus.emit("runmove", mv);
      }
      return;
    }
  });

  eventBus.on<string>("analyze-btn-click", async (mode) => {
    if (!mode) return;
    if (engine.isReady()) {
      dispatchMode(mode);
      return;
    }
    const missing = await engine.checkFileExists();
    if (missing.length > 0) {
      engine.openDownloadModal(missing);
      return;
    }
    try {
      await engine.ensureReady();
    } catch (e) {
      console.error("[Engine] ensureReady failed:", e);
      return;
    }
    dispatchMode(mode);
  });

  eventBus.on("engine-auto-toggle", () => {
    if (autoAnalyze) {
      autoAnalyze = false;
      eventBus.emit("engine-auto-off");
      eventBus.emit("engine-stop");
    } else {
      autoAnalyze = true;
      eventBus.emit("engine-auto-on");
      eventBus.emit("engine-analyze", true);
    }
  });

  eventBus.on("request-engine-state", () => {
    if (autoAnalyze) {
      eventBus.emit("engine-auto-on");
    }
    if (analyzing) {
      eventBus.emit("engine-busy");
    }
    if (batchAnalyzing) {
      eventBus.emit("engine-batch-start");
    }
    eventBus.emit("engine-sim-state", { white: simWhite, black: simBlack });
  });

  eventBus.on<Move>("runmove", (move) => {
    // Simulation: reply to any played move (the human's or the engine's
    // own) after the configured interval. Must run before the lastResult
    // early-return below: sim moves don't populate lastResult, so a
    // human reply would otherwise never wake the engine.
    if (simActive()) {
      scheduleSim();
    }
    if (!move || !lastResult || lastResult.bestmove === "(none)") return;
    // Castling must be compared king-takes-rook (moveToUci) to match
    // bestmove under UCI_Chess960.
    const moveUci = moveToUci(move).slice(0, 4);
    if (moveUci === lastResult.bestmove.slice(0, 4)) {
      if (lastResult.ponder) {
        const ponderMove = lastResult.ponder;
        lastResult = {
          bestmove: ponderMove,
          score: lastResult.score,
          depth: lastResult.depth,
          scoreType: lastResult.scoreType,
        };
        eventBus.emit("engine-result", lastResult);
      } else {
        lastResult = null;
        eventBus.emit("engine-result", null);
      }
    } else {
      lastResult = null;
      eventBus.emit("engine-result", null);
    }

    if (autoAnalyze) {
      const nodeId = h.currentNode.id;
      if (analyzing) {
        pendingNodeId = nodeId;
        engine.stop();
      } else {
        eventBus.emit("engine-analyze", true);
      }
    }

    if (batchAnalyzing) {
      needRebuildBatch = true;
    }
  });

  eventBus.on("updateUI", () => {
    if (h.generation !== lastGen) {
      lastGen = h.generation;
      lastNodeId = null;
      lastResult = null;
      batchCancelled = true;
      simFenCounts.clear();
      clearGhosts();
      if (analyzing) {
        engine.stop();
      }
    }
    // Ghost lines are live-only: navigating away from the analyzed node
    // discards them, then rebuilds from the visited node's stored eval
    // so already-analyzed nodes show their candidate lines on revisit.
    // Derived evals ride an ancestor's PV line; only a real search of
    // the node itself yields ghost lines here.
    if (ghostLines && ghostLines.nodeId !== h.currentNode.id) {
      clearGhosts();
    }
    if (!ghostLines) {
      const node = h.currentNode;
      if (node?.eval?.pvs && !node.eval.derived) {
        emitGhosts();
      }
    }
    if (!autoAnalyze) return;
    const nodeId = h.currentNode.id;
    if (nodeId === lastNodeId) return;
    lastNodeId = nodeId;
    if (analyzing) {
      pendingNodeId = nodeId;
      engine.stop();
    } else {
      eventBus.emit("engine-analyze", true);
    }
  });

  eventBus.on("engine-analyze", async (skipExisting?: boolean) => {
    try {
      await engine.ensureReady();
    } catch (e) {
      console.error("[Engine] ensureReady failed:", e);
      return;
    }
    const nodeId = h.currentNode.id;
    if (analyzing) {
      pendingNodeId = nodeId;
      // A fresh request also revives a search draining after engine-stop:
      // the draining search's partial result applies normally, then the
      // pending node is analyzed via the pendingNodeId re-emit.
      stopped = false;
      engine.stop();
      return;
    }
    const node = h.nodeMap.get(nodeId);
    if (!node) return;
    // Only a real search of THIS node is a cache hit. Derived evals ride
    // an ancestor's PV line whose horizon shrinks one ply per move, so
    // they never substitute for a full-depth analysis here: re-search
    // instead — the transposition table already holds the previous
    // search, so each search only extends the tree by one ply.
    if (
      node.eval &&
      node.eval.depth >= settings.engineDepth &&
      !node.eval.derived
    ) {
      // Repopulate before the skipExisting early-return: auto-analyze
      // revisits an analyzed node with skipExisting=true and would
      // otherwise leave it without ghost lines.
      emitGhosts();
      if (skipExisting) return;
      eventBus.emit("engine-busy");
      eventBus.emit("engine-result", {
        bestmove: node.eval.bestmove,
        ponder: node.eval.ponder,
        score: node.eval.score,
        depth: node.eval.depth,
        scoreType: node.eval.scoreType,
      });
      return;
    }
    // A simulation search owns the engine right now; skip so we never
    // cancel its in-flight search. Auto-analyze re-fires on the next
    // node change, and the sim itself fills the eval.
    if (simSearching) return;
    analyzing = true;
    stopped = false;
    const gen = h.generation;
    applyOptions();
    eventBus.emit("engine-busy");
    // Depth iterations can arrive in bursts; throttle the live updates
    // (trailing edge: delayed, never dropped).
    const progress = throttleProgress(125, (p) => {
      if (stopped || gen !== h.generation) return;
      if (h.currentNode.id !== nodeId) return;
      applySearchProgress(node, p);
    });
    try {
      const result = await engine.analyze(
        node.fen,
        settings.engineDepth,
        progress.throttled,
      );
      if (stopped || gen !== h.generation) return;
      if (result && result.score != null) {
        applyResultToNode(node, result);
        if (h.currentNode.id === nodeId) {
          h.currentNode = node;
          emitGhosts();
        }
        lastResult = result;
        eventBus.emit("engine-result", result);
        if (settings.saveEvalPrompt || settings.saveEvalByDefault) {
          h.eventBus.emit("modified", null);
        }
        h.eventBus.emit("updateUI");
        return;
      }
      eventBus.emit("engine-result", result);
    } catch (err) {
      if (stopped) return;
      // Superseded by a newer search: not a failure.
      if (
        err instanceof Error &&
        err.message.startsWith("Analysis cancelled")
      ) {
        return;
      }
      console.error("[Engine] analyze failed:", err);
      eventBus.emit("engine-result", null);
      return;
    } finally {
      progress.cancel();
      analyzing = false;
      if (!stopped && pendingNodeId) {
        pendingNodeId = null;
        eventBus.emit("engine-analyze", true);
      }
    }
  });

  eventBus.on("engine-analyze-batch", async () => {
    try {
      await engine.ensureReady();
    } catch (e) {
      console.error("[Engine] ensureReady failed:", e);
      return;
    }
    if (analyzing || simSearching) return;
    analyzing = true;
    stopped = false;
    batchCancelled = false;
    batchAnalyzing = true;
    needRebuildBatch = false;
    applyOptions();
    eventBus.emit("engine-busy");
    eventBus.emit("engine-batch-start");
    try {
      const nodeMap = h.nodeMap;
      const buildQueue = (): string[] => {
        const pathSet = new Set<string>(h.currentPath);
        const pathQueue: string[] = [];
        const restQueue: string[] = [];
        for (const [, node] of nodeMap) {
          // Derived evals (attributed from an ancestor's PV line) have a
          // shrinking horizon — queue them for a real full-depth search.
          if (
            !node.eval ||
            node.eval.depth < settings.engineDepth ||
            node.eval.derived
          ) {
            if (pathSet.has(node.id)) {
              pathQueue.push(node.id);
            } else {
              restQueue.push(node.id);
            }
          }
        }
        return pathQueue.concat(restQueue);
      };
      batchQueue = buildQueue();

      for (let i = 0; i < batchQueue.length; i++) {
        if (batchCancelled || stopped) break;
        const nodeId = batchQueue[i];
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        // Mid-batch, fillChildrenFromEval may have written a derived
        // eval onto this node after it was queued — still re-search it.
        if (
          node.eval &&
          node.eval.depth >= settings.engineDepth &&
          !node.eval.derived
        ) {
          continue;
        }
        try {
          // Only the viewed node streams live updates; the rest of the
          // batch is processed silently.
          const progress = throttleProgress(125, (p) => {
            if (stopped || batchCancelled) return;
            if (h.currentNode.id !== nodeId) return;
            applySearchProgress(node, p);
          });
          let result: EngineResult;
          try {
            result = await engine.analyze(
              node.fen,
              settings.engineDepth,
              progress.throttled,
            );
          } finally {
            progress.cancel();
          }
          if (stopped || batchCancelled) break;
          if (result && result.score != null) {
            const nodeEval = applyResultToNode(node, result);
            if (h.currentNode.id === nodeId) {
              h.currentNode = node;
              emitGhosts();
              h.eventBus.emit("engine-result", {
                bestmove: result.bestmove,
                ponder: result.ponder,
                score: nodeEval.score,
                depth: nodeEval.depth,
                scoreType: nodeEval.scoreType,
              });
            }
            h.eventBus.emit("updateUI");
          }
        } catch {
          break;
        }
        if (needRebuildBatch && !batchCancelled && !stopped) {
          needRebuildBatch = false;
          batchQueue = buildQueue();
          i = -1;
        }
      }
      if (stopped) return;
      const currentNodeEval = h.currentNode?.eval;
      if (currentNodeEval?.bestmove) {
        h.eventBus.emit("engine-result", {
          bestmove: currentNodeEval.bestmove,
          ponder: currentNodeEval.ponder,
          score: currentNodeEval.score,
          depth: currentNodeEval.depth,
          scoreType: currentNodeEval.scoreType,
        });
      } else {
        h.eventBus.emit("clear-engine-bestmove");
      }
      if (settings.saveEvalPrompt || settings.saveEvalByDefault) {
        h.eventBus.emit("modified", null);
      }
      h.eventBus.emit("updateUI");
      h.eventBus.emit("engine-batch-done");
    } catch {
      if (!stopped) {
        eventBus.emit("engine-batch-done");
      }
      return;
    } finally {
      analyzing = false;
      batchAnalyzing = false;
      // Honor a single-analysis request that arrived while the batch
      // held `analyzing` (same re-emit as the single handler's finally).
      if (!stopped && pendingNodeId) {
        pendingNodeId = null;
        eventBus.emit("engine-analyze", true);
      }
    }
  });

  eventBus.on("engine-stop", () => {
    stopped = true;
    batchCancelled = true;
    engine.stop();
    // `analyzing` is deliberately NOT cleared here: the in-flight
    // search's promise is still draining until the worker answers
    // "stop" with "bestmove". Clearing it early let a second
    // engine.analyze() start while the first was pending, which
    // rejected the old promise ("Analysis cancelled") and clobbered
    // the new run's flags in the old handler's finally. The owner's
    // finally clears it when the promise settles.
    pendingNodeId = null;
    lastResult = null;
    clearGhosts();
    if (autoAnalyze) {
      autoAnalyze = false;
      eventBus.emit("engine-auto-off");
    }
    if (batchAnalyzing) {
      batchAnalyzing = false;
      eventBus.emit("engine-batch-done");
    }
  });

  eventBus.on("engine-batch-stop", () => {
    batchCancelled = true;
    if (analyzing && !pendingNodeId) {
      engine.stop();
    }
  });

  // ---- Engine simulation (engine plays a side, or self-play) ----

  const simChess = new Chess();

  function simActive(): boolean {
    return simWhite || simBlack;
  }

  function clearSimTimer() {
    if (simTimer !== null) {
      window.clearTimeout(simTimer);
      simTimer = null;
    }
  }

  function emitSimState() {
    eventBus.emit("engine-sim-state", { white: simWhite, black: simBlack });
  }

  function stopSim() {
    simWhite = false;
    simBlack = false;
    clearSimTimer();
    simFenCounts.clear();
    emitSimState();
  }

  function scheduleSim(delayMs?: number) {
    clearSimTimer();
    if (!simActive()) return;
    const seconds =
      settings.engineSimInterval > 0 ? settings.engineSimInterval : 1;
    simTimer = window.setTimeout(
      () => {
        simTimer = null;
        void simPlayMove();
      },
      delayMs ?? seconds * 1000,
    );
  }

  /** Converts a UCI bestmove (UCI_Chess960: castling = king-takes-rook,
   * promotions carry a 5th char) back into a chess.js move. */
  function simUciToMove(fen: string, uci: string): Move | null {
    try {
      simChess.load(fen);
      const args: { from: string; to: string; promotion?: string } = {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
      };
      if (uci.length > 4) {
        args.promotion = uci.slice(4, 5);
      }
      return simChess.move(args);
    } catch {
      return null;
    }
  }

  /** Stops the simulation on endless shuffling: threefold repetition of
   * the same position or the 50-move rule (halfmove clock reaches 100). */
  function simReachedRepetition(fen: string): boolean {
    const parts = fen.split(" ");
    const halfmove = Number.parseInt(parts[4] ?? "0", 10) || 0;
    if (halfmove >= 100) {
      return true;
    }
    const key = parts.slice(0, 4).join(" ");
    const count = (simFenCounts.get(key) ?? 0) + 1;
    simFenCounts.set(key, count);
    return count >= 3;
  }

  async function simPlayMove() {
    if (!simActive()) return;
    const node = h.currentNode;
    if (!node) {
      stopSim();
      return;
    }
    if (getAutoResult(node.fen) || simReachedRepetition(node.fen)) {
      stopSim();
      return;
    }
    const turn = node.fen.split(" ")[1];
    const sideOn = turn === "b" ? simBlack : simWhite;
    if (!sideOn) return; // human's turn — wait for their move
    if (analyzing || batchAnalyzing || simSearching) {
      scheduleSim(500);
      return;
    }
    // Only trust an eval that was searched AT this node. Derived evals
    // ride an ancestor's PV line whose horizon shrinks one ply per move:
    // playing them for free makes the sim burst through several moves
    // and then stall on one full re-search. Re-searching each move at
    // full depth keeps the think time uniform — the engine's
    // transposition table already holds the previous search, so each
    // search only extends the tree by one ply.
    let bestmove: string | undefined =
      node.eval && node.eval.depth >= settings.engineDepth && !node.eval.derived
        ? node.eval.bestmove
        : undefined;
    if (!bestmove) {
      simSearching = true;
      try {
        if (!engine.isReady()) {
          await engine.ensureReady();
          if (!simActive()) return;
        }
        applyOptions();
        const result = await engine.analyze(node.fen, settings.engineDepth);
        if (!simActive()) return;
        if (result && result.score != null) {
          applyResultToNode(node, result);
          if (h.currentNode.id === node.id) {
            h.currentNode = node;
            emitGhosts();
          }
          if (settings.saveEvalPrompt || settings.saveEvalByDefault) {
            h.eventBus.emit("modified", null);
          }
          h.eventBus.emit("updateUI");
          bestmove = result.bestmove !== "(none)" ? result.bestmove : undefined;
        }
      } catch {
        // Search cancelled or failed — retry on the next tick.
      } finally {
        simSearching = false;
      }
      if (!simActive()) return;
    }
    if (!bestmove) {
      scheduleSim(500);
      return;
    }
    const move = simUciToMove(node.fen, bestmove);
    if (!move) {
      stopSim();
      return;
    }
    eventBus.emit("runmove", move);
    // The played node was created after applyResultToNode filled the
    // searched node's earlier children, so it has no eval yet and the
    // current-node eval bar stays blank until the next tick. Derive one
    // from the same search (the played move is the PV's first move) for
    // immediate display. Display-only: the derived flag makes the next
    // sim step re-search this node at full depth and replace it.
    if (fillChildrenFromEval(node)) {
      h.eventBus.emit("updateUI");
    }
    scheduleSim();
  }

  eventBus.on<string>("engine-sim-toggle", async (side) => {
    if (side === "white") {
      simWhite = !simWhite;
    } else if (side === "black") {
      simBlack = !simBlack;
    } else {
      return;
    }
    emitSimState();
    if (!simActive()) {
      clearSimTimer();
      simFenCounts.clear();
      return;
    }
    if (!engine.isReady()) {
      const missing = await engine.checkFileExists();
      if (missing.length > 0) {
        engine.openDownloadModal(missing);
        stopSim();
        return;
      }
      try {
        await engine.ensureReady();
      } catch (e) {
        console.error("[Engine] ensureReady failed:", e);
        stopSim();
        return;
      }
    }
    scheduleSim(0);
  });

  eventBus.on("clear-engine-bestmove", () => {
    lastResult = null;
  });

  eventBus.on("unload", () => {
    stopSim();
    engine.terminate();
  });

  return {
    destroy() {
      stopSim();
      engine.terminate();
    },
  };
}

export const EngineModule = { init: initEngine };
