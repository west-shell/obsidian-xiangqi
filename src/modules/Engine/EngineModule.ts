import type { ChessNode, IHost, NodeEval, PvLine } from "../../types";
import type { Move } from "../../chess";
import { moveToUci } from "../../chess";
import { engine } from "./Engine";
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
  });

  eventBus.on<Move>("runmove", (move) => {
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
    analyzing = true;
    stopped = false;
    const gen = h.generation;
    applyOptions();
    eventBus.emit("engine-busy");
    try {
      const result = await engine.analyze(node.fen, settings.engineDepth);
      if (stopped || gen !== h.generation) return;
      if (result && result.score != null) {
        const score = toWhiteView(result.score, result.scoreType, node.fen);
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
        // Attribute the finished search to existing children (their
        // positions were covered by its PV lines), so stepping through
        // them hits the cache instead of re-searching.
        fillChildrenFromEval(node);
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
    if (analyzing) return;
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
            const score = toWhiteView(result.score, result.scoreType, node.fen);
            node.eval = {
              score,
              scoreType: result.scoreType ?? "cp",
              depth: result.depth ?? 0,
              bestmove:
                result.bestmove !== "(none)" ? result.bestmove : undefined,
              ponder: result.ponder,
              pvs: toWhiteViewPvs(result.pvs, node.fen),
            };
            setNodeGlyph(node);
            fillChildrenFromEval(node);
            if (h.currentNode.id === nodeId) {
              h.currentNode = node;
              h.eventBus.emit("engine-result", {
                bestmove: result.bestmove,
                ponder: result.ponder,
                score,
                depth: result.depth,
                scoreType: result.scoreType,
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

  eventBus.on("clear-engine-bestmove", () => {
    lastResult = null;
  });

  eventBus.on("unload", () => {
    engine.terminate();
  });

  return {
    destroy() {
      engine.terminate();
    },
  };
}

export const EngineModule = { init: initEngine };
