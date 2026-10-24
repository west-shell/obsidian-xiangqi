import type { ChessNode, IHost, NodeEval, PvLine } from "../../types";
import type { Move } from "../../chess";
import { Chess, getAutoResult, moveToUci } from "../../chess";
import { engine, type EngineResult } from "./Engine";
import { deriveChildEval, fillChildrenFromEval } from "./pv-cache";
import { computeGlyph } from "../../utils/winningChances";

/** Number of candidate lines requested from the engine (MultiPV). */
const MULTI_PV = 3;

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

  function applyOptions() {
    engine.postCommand(
      `setoption name Skill Level value ${settings.engineSkillLevel}`,
    );
    engine.postCommand(`setoption name Ponder value false`);
    // A larger transposition table keeps prior searches reusable when
    // positions are revisited or re-searched deeper.
    engine.postCommand(`setoption name Hash value 64`);
    engine.postCommand(`setoption name MultiPV value ${MULTI_PV}`);
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
   * The parent's eval when it can serve as an analysis cache for its
   * children: deep enough for the requested depth, with its PV lines
   * covering the positions one ply down.
   */
  function parentEvalFor(node: ChessNode): NodeEval | undefined {
    if (!node.parentID) return undefined;
    const parent = h.nodeMap.get(node.parentID);
    const ev = parent?.eval;
    return ev && ev.depth >= settings.engineDepth ? ev : undefined;
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

  function dispatchMode(mode: string) {
    if (mode === "once") {
      eventBus.emit("engine-analyze");
    } else if (mode === "auto") {
      eventBus.emit("engine-auto-toggle");
    } else if (mode === "batch") {
      eventBus.emit("engine-analyze-batch");
    }
  }

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
      if (analyzing) {
        engine.stop();
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
      engine.stop();
      return;
    }
    const node = h.nodeMap.get(nodeId);
    if (!node) return;
    if (node.eval && node.eval.depth >= settings.engineDepth) {
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
    // Cache hit from the parent's own search: when the played move
    // starts one of the parent's PV lines, this position was already
    // evaluated by that search — reuse its result instead of searching
    // again from scratch.
    if (!node.eval || node.eval.depth < settings.engineDepth) {
      const derived = deriveChildEval(
        parentEvalFor(node),
        node.move ? moveToUci(node.move) : "",
      );
      if (derived) {
        node.eval = derived;
        setNodeGlyph(node);
        if (h.currentNode.id === nodeId) {
          h.currentNode = node;
        }
        eventBus.emit("engine-busy");
        eventBus.emit("engine-result", {
          bestmove: derived.bestmove,
          ponder: derived.ponder,
          score: derived.score,
          depth: derived.depth,
          scoreType: derived.scoreType,
        });
        if (settings.saveEvalPrompt || settings.saveEvalByDefault) {
          h.eventBus.emit("modified", null);
        }
        h.eventBus.emit("updateUI");
        return;
      }
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
    try {
      const result = await engine.analyze(node.fen, settings.engineDepth);
      if (stopped || gen !== h.generation) return;
      if (result && result.score != null) {
        applyResultToNode(node, result);
        if (h.currentNode.id === nodeId) {
          h.currentNode = node;
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
      console.error("[Engine] analyze failed:", err);
      eventBus.emit("engine-result", null);
      return;
    } finally {
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
          if (!node.eval || node.eval.depth < settings.engineDepth) {
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
        if (node.eval && node.eval.depth >= settings.engineDepth) continue;
        try {
          const result = await engine.analyze(node.fen, settings.engineDepth);
          if (stopped || batchCancelled) break;
          if (result && result.score != null) {
            const nodeEval = applyResultToNode(node, result);
            if (h.currentNode.id === nodeId) {
              h.currentNode = node;
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
    }
  });

  eventBus.on("engine-stop", () => {
    stopped = true;
    batchCancelled = true;
    engine.stop();
    analyzing = false;
    pendingNodeId = null;
    lastResult = null;
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
    let bestmove: string | undefined =
      node.eval && node.eval.depth >= settings.engineDepth
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
