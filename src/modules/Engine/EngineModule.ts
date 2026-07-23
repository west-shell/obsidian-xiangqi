import type { IPGNViewHost, ITreeHost, NodeEval } from "../../types";
import type { Move } from "../../chess";
import {
  registerPGNViewModule,
  registerTreeModule,
} from "../../core/module-system";
import { engine } from "./Engine";

function initEngine(host: object) {
  const h = host as ITreeHost | IPGNViewHost;
  engine.setPlugin(h.plugin);
  const { eventBus, settings } = h;

  let analyzing = false;
  let batchCancelled = false;
  let engineFileExists = false;
  let pendingNodeId: string | null = null;
  let stopped = false;
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
  });

  eventBus.on("engine-analyze", async () => {
    if (!engineFileExists) {
      const missing = await engine.checkFileExists();
      if (missing.length > 0) {
        engine.openDownloadModal(missing);
        return;
      }
      engineFileExists = true;
    }
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
        eventBus.emit("engine-analyze");
      }
    }
  });

  eventBus.on("engine-analyze-batch", async () => {
    if (!engineFileExists) {
      const missing = await engine.checkFileExists();
      if (missing.length > 0) {
        engine.openDownloadModal(missing);
        return;
      }
      engineFileExists = true;
    }
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
    applyOptions();
    eventBus.emit("engine-busy");
    try {
      const pathSet = new Set<string>(h.currentPath);
      const pathQueue: string[] = [];
      const restQueue: string[] = [];
      const nodeMap = h.nodeMap;
      for (const [, node] of nodeMap) {
        if (!node.eval || node.eval.depth < settings.engineDepth) {
          if (pathSet.has(node.id)) {
            pathQueue.push(node.id);
          } else {
            restQueue.push(node.id);
          }
        }
      }
      const queue = pathQueue.concat(restQueue);
      for (const nodeId of queue) {
        if (batchCancelled || stopped) break;
        const node = nodeMap.get(nodeId);
        if (!node) continue;
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
    }
  });

  eventBus.on("engine-stop", () => {
    stopped = true;
    batchCancelled = true;
    engine.stop();
    analyzing = false;
    pendingNodeId = null;
    lastResult = null;
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

registerTreeModule("engine", { init: initEngine });
registerPGNViewModule("engine", { init: initEngine });
