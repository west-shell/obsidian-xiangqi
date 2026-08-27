import type { ChessNode, IHost, NodeEval } from "../../types";
import type { Move } from "../../chess";
import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import { engine } from "./Engine";
import { computeGlyph } from "../../utils/winningChances";

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
    engine.postCommand(`setoption name Hash value 16`);
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

  function setNodeGlyph(node: ChessNode) {
    if (!node.parentID) {
      node.glyph = null;
      for (const child of node.children) {
        if (child.eval) {
          child.glyph = computeGlyph(node.eval, child.eval, child.color);
        }
      }
      return;
    }
    const parent = h.nodeMap.get(node.parentID);
    node.glyph = computeGlyph(parent?.eval, node.eval, node.color);
    for (const child of node.children) {
      if (child.eval) {
        child.glyph = computeGlyph(node.eval, child.eval, child.color);
      }
    }
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

  eventBus.on<Move>("runmove", (move) => {
    if (!move || !lastResult || lastResult.bestmove === "(none)") return;
    const moveUci = move.from + move.to;
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
    analyzing = true;
    stopped = false;
    applyOptions();
    eventBus.emit("engine-busy");
    try {
      const result = await engine.analyze(node.fen, settings.engineDepth);
      if (stopped) return;
      if (result && result.score != null) {
        const score = toWhiteView(result.score, result.scoreType, node.fen);
        const nodeEval: NodeEval = {
          score,
          scoreType: result.scoreType ?? "cp",
          depth: result.depth ?? 0,
          bestmove: result.bestmove !== "(none)" ? result.bestmove : undefined,
          ponder: result.ponder,
        };
        node.eval = nodeEval;
        setNodeGlyph(node);
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
            };
            setNodeGlyph(node);
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

registerBlockModule("engine", { init: initEngine });
registerFileModule("engine", { init: initEngine });
